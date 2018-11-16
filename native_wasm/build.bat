@echo off

REM This assumes you installed emsdk at this path: c:\work\emsdk\
REM See 'https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html'
REM call c:\work\emsdk\emsdk_env.bat

if exist d:\work\emsdk\emscripten\1.38.8\em++.bat (
    del out\voymod.wasm
    del out\voymod.js
) else (
    md out
)

if exist d:\work\emsdk\emscripten\1.38.8\em++.bat (
    REM -s NO_FILESYSTEM=1 
    d:\work\emsdk\emscripten\1.38.8\em++.bat ..\native\VoyageCalculator.cpp main.cpp -o out\voymod.js --bind -O2 -std=c++1y -s ASSERTIONS=1 -s DISABLE_EXCEPTION_CATCHING=0 -s NO_EXIT_RUNTIME=1 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME="VoyMod" -I "." -I "..\native"
) else (
    echo Can't find EMSDK at 'c:\work\emsdk\'. Install it from 'https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html'
)


