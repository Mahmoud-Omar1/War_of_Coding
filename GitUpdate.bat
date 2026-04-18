@echo off

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/Mahmoud-Omar1/War_of_Coding
git push -u origin main

pause