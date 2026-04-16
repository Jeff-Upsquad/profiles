#!/bin/bash
set -e
cd /Users/jeffzeena/Profiles
git add -A
git commit -m "${1:-update}"
git push origin main
