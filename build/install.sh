#!/bin/sh
clear
echo "Create pre-commit hook sym link"
ln -sf ../../build/pre-commit .git/hooks/pre-commit
echo "Ensure pre-commit hook is executable"
chmod +x build/pre-commit
echo "Run grunt build task"
grunt build
clear
echo "Installation complete"