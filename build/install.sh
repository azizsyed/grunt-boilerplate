#!/bin/sh
clear
#echo "Create pre-commit hook sym link"
#ln -sf ../../build/pre-commit .git/hooks/pre-commit
#echo "Ensure pre-commit hook is executable"
#chmod +x build/pre-commit
echo "Install Node modules"
npm install
echo "Running grunt build"
grunt build
echo "Fixing file permissons for 'deploy'"
sudo chmod -R a+rw deploy/*
sudo chmod -R a+rw .sass-cache
clear
echo "============================="
echo "=   Installation complete   ="
echo "============================="
