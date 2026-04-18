@echo off

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main

pause