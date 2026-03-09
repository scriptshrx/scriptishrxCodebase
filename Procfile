# set NODE_OPTIONS or adjust memory using --max-old-space-size if you run into
# heap out-of-memory errors during document ingestion.  Render allows you to
# configure environment variables in the dashboard; the command below provides
# a fallback default of 512MB for the heap.
web: NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_SIZE:-512}" npm start
