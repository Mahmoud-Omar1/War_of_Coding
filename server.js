require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// =========================
// STATIC FRONTEND
// =========================
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// GENERATE PROBLEM (AI)
// =========================
async function safeFetch(url, options, retries = 2) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries > 0) {
      console.log("Retrying request...");
      return safeFetch(url, options, retries - 1);
    }
    throw err;
  }
}

app.post('/generate-problem', async (req, res) => {
  const { language, difficulty } = req.body;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const response = await safeFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a strict JSON generator. You must return ONLY valid JSON. No markdown. No explanation."
          },
          {
            role: "user",
            content: `You are an expert competitive programming problem setter.

Your task is to generate a unique programming problem based on the requested difficulty level.

Strictly follow these rules:

1. The problem must be original and not a trivial variation of common beginner problems.
2. The difficulty must match the requested level exactly:

   * Easy:

     * Basic conditions, loops, arrays, strings
     * Simple implementation
     * No advanced algorithms
   * Medium:

     * Requires problem-solving skills
     * May involve sorting, greedy, maps, prefix sums, or binary search
     * Requires some reasoning before coding
   * Hard:

     * Requires advanced reasoning
     * May involve dynamic programming, graphs, advanced greedy, recursion, or optimization
     * Must not be solvable by simple loops only
     * Must challenge experienced programmers
3. Do not generate repetitive problems.
4. Do not generate trivial tasks such as:

   * "take a number and print it"
   * "sum two numbers"
   * "reverse a string"
   * "find max element"
     unless the requested level is Easy.
5. For Hard difficulty:

   * The problem must require multi-step logic.
   * The solution should not be obvious immediately.
   * The problem should require algorithmic thinking.
6. The problem statement must be clear and professional.

Return the result in this JSON format only:

{
  "title": "Problem title",
  "description": "Detailed problem statement",
  "input_format": "Input description",
  "output_format": "Output description",
  "constraints": "Problem constraints",
  "sample_input": "Example input",
  "sample_output": "Example output",
  "tests": [
    { "input": "test input 1", "output": "expected output 1" },
    { "input": "test input 2", "output": "expected output 2" },
    { "input": "test input 3", "output": "expected output 3" }
  ]
}

Rules for tests:
1. Generate at least 3 hidden test cases
2. Hidden tests must validate correctness
3. Hidden tests must include edge cases
4. Do not display hidden tests in sample_input/sample_output
5. Ensure outputs are exact

Hidden tests must include:
- minimum valid input
- maximum valid input
- edge cases
- normal cases

Now generate one problem with difficulty: ${difficulty}
and programming language context: ${language} `
          }
        ],
        temperature: 0.5
      }),
       signal: controller.signal
    });

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content || "";

    console.log("RAW AI:", content);


    const cleaned = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.json({
        title: "Fallback problem",
        description: "Problem generation failed",
        input_format: "",
        output_format: "",
        constraints: "",
        sample_input: "",
        sample_output: "",
        tests: [{ input: "1", output: "1" }]
      });
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    return res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
  clearTimeout(timeout);
});

// =========================
// RUN CODE (JUDGE0)
// =========================
app.post('/run', async (req, res) => {
  const { source_code, stdin, language_id } = req.body;

  try {
    const response = await fetch(
      'https://ce.judge0.com/submissions?wait=true&base64_encoded=true',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: Buffer.from(source_code).toString("base64"),
          stdin: Buffer.from(stdin || "").toString("base64"),
          language_id
        })
      }
    );

    const result = await response.json();

    const output =
      result.stdout ||
      result.stderr ||
      result.compile_output ||
      "";

    return res.json({
      output: Buffer.from(output, "base64").toString("utf-8")
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});
// =========================
// SUBMIT (AUTO JUDGE)
// =========================
app.post('/submit', async (req, res) => {
  const { source_code, language_id, tests } = req.body;

  try {
    for (const test of tests) {

      const response = await fetch(
        'https://ce.judge0.com/submissions?wait=true&base64_encoded=true',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source_code: Buffer.from(source_code).toString("base64"),
            stdin: Buffer.from(test.input || "").toString("base64"),
            language_id
          })
        }
      );

      const result = await response.json();

      const output = Buffer.from(
        result.stdout || result.stderr || result.compile_output || "",
        "base64"
      ).toString("utf-8").trim();

      const expected = (test.output || "").trim();

      console.log("TEST RESULT:", {
        input: test.input,
        output,
        expected
      });

      if (output !== expected) {
        return res.json({
          verdict: "Wrong Answer"
        });
      }
    }

    return res.json({
      verdict: "Accepted"
    });

  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
});

// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
