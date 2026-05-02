const editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
  mode: "text/x-c++src",
  theme: "dracula",
  lineNumbers: true,
  Highlight: true
});

editor.setValue(`#include <iostream>
using namespace std;

int main(){ 

    return 0; 
}`);

var val = document.getElementById("language");

document.getElementById("language").addEventListener("change", function () {
  const langId = Number(this.value);

  if (langId === 54) {
    editor.setValue(`#include <iostream>
using namespace std;

int main(){ 

    return 0; 
}`);
  }
  else if (langId === 62) {
    editor.setValue(`public class Script{
    public static void main(String[] args){
        
    }
}`);
  }
  else if (langId === 71) {
    editor.setValue(`print('Hello World!')`);
  }
});

const terminal = new Terminal({
  cursorBlink: true,
  theme: {
    background: "#0d1117",
    foreground: "#e6edf3"
  }
});

terminal.open(document.getElementById("terminal"));
terminal.writeln("War of Coding Terminal Ready...");
terminal.write("> ");

let currentProblem = null;
let currentInput = "";
let waitingForInput = false;

function writeSuccess(text) {
  terminal.writeln(`\x1b[32m${text}\x1b[0m`);
}

function writeError(text) {
  terminal.writeln(`\x1b[31m${text}\x1b[0m`);
}

function writeInfo(text) {
  terminal.writeln(`\x1b[33m${text}\x1b[0m`);
}

terminal.attachCustomKeyEventHandler((e) => {
  if (!waitingForInput) return true;

  if (e.type === "keydown") {
    if (e.key === "Enter" && e.ctrlKey) {
      waitingForInput = false;
      terminal.writeln("");
      executeCode(currentInput);
      return false;
    }
  }

  return true;
});

terminal.onData((data) => {
  if (!waitingForInput) return;

  if (data === "\r") {
    currentInput += "\n";
    terminal.writeln("");
  } else if (data === "\u007F") {
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
      terminal.write("\b \b");
    }
  } else {
    currentInput += data;
    terminal.write(data);
  }
});

async function generateProblem() {
  const lang = document.getElementById("language").selectedOptions[0].text;
  const diff = document.getElementById("difficulty").value;

  const problemBox = document.getElementById("problemBox");

  problemBox.innerHTML = `
    <div class="problem-loading">
      Generating Problem...
    </div>
  `;

  try {
    const res = await fetch("/generate-problem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang, difficulty: diff })
    });

    const data = await res.json();
    currentProblem = data;

    problemBox.innerHTML = `
      <div class="problem-card">
        <h2 class="problem-title">${data.title || "Untitled Problem"}</h2>

        <div class="problem-section">
          <h4>Description</h4>
          <p>${data.description || ""}</p>
        </div>

        <div class="problem-section">
          <h4>Input Format</h4>
          <p>${data.input_format || ""}</p>
        </div>

        <div class="problem-section">
          <h4>Output Format</h4>
          <p>${data.output_format || ""}</p>
        </div>

        <div class="problem-section">
          <h4>Constraints</h4>
          <p>${data.constraints || ""}</p>
        </div>

        <div class="problem-section">
          <h4>Sample Input</h4>
          <pre>${data.sample_input || ""}</pre>
        </div>

        <div class="problem-section">
          <h4>Sample Output</h4>
          <pre>${data.sample_output || ""}</pre>
        </div>
      </div>
    `;
  } catch (error) {
    problemBox.innerHTML = `
      <div class="problem-error">
        Failed to generate problem
      </div>
    `;
  }
}

function runCode() {
  currentInput = "";
  terminal.clear();

  writeInfo("Running...");
  terminal.writeln("Press Ctrl+Enter to execute.");
  terminal.writeln("Enter your input below.");
  terminal.write("Input> ");

  waitingForInput = true;
}

async function executeCode(stdin) {
  const res = await fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_code: editor.getValue(),
      stdin,
      language_id: Number(document.getElementById("language").value)
    })
  });

  const data = await res.json();

  terminal.writeln("");

  if (!data.output || data.output.trim() === "") {
    writeInfo("No output");
  } else if (
    data.output.toLowerCase().includes("error") ||
    data.output.toLowerCase().includes("exception")
  ) {
    writeError(data.output);
  } else {
    writeSuccess("Output:");
    terminal.writeln(data.output);
  }

  terminal.write("> ");
}

async function submitSolution() {
  if (!currentProblem || !currentProblem.tests || currentProblem.tests.length === 0) {
    showVerdictModal("No test cases available");
    return;
  }

  const res = await fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_code: editor.getValue(),
      language_id: Number(document.getElementById("language").value),
      tests: currentProblem.tests
    })
  });

  const data = await res.json();
  showVerdictModal(data.verdict);
}

function showVerdictModal(verdict) {
  const modal = new bootstrap.Modal(document.getElementById("verdictModal"));
  const iconEl = document.getElementById("verdictIcon");
  const textEl = document.getElementById("verdictText");
  const subEl = document.getElementById("verdictSub");

  if (
    verdict &&
    (verdict.toLowerCase().includes("accept") ||
      verdict.toLowerCase().includes("correct"))
  ) {
    iconEl.innerHTML = "✅";
    iconEl.style.color = "#00ffcc";
    textEl.style.color = "#00ffcc";
    textEl.innerHTML = "الحل <strong>صح يابطل عاش</strong>";
    subEl.textContent = "Congrats! Hero 🎉🎈";
  } else {
    iconEl.innerHTML = "❌";
    iconEl.style.color = "#ff4444";
    textEl.style.color = "#ff4444";
    textEl.innerHTML = "الحل <strong>غلط للاسف</strong>";
    subEl.textContent = "Try Agian Hero! 🔥🔥";
  }

  modal.show();
}