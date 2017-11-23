rm -rf dist
cp -r src dist
babel src/ -d dist/ "$@" --source-maps --ignore src/test/fixtures
