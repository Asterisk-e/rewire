# Local browser models

Place each Transformers.js-compatible ONNX model in its own folder beneath `models/`.

Example:

```text
models/
  qwen-instruct/
    config.json
    tokenizer.json
    tokenizer_config.json
    generation_config.json
    onnx/
      model.onnx
```

The exact required files depend on the model. Use a model repository or export that specifically includes ONNX weights compatible with Hugging Face Transformers.js. Local Studio disables remote model downloads, so inference does not fetch model files from the internet.

Model weights are not included in this source archive because they are large and their licences vary. Obtain and check the model's licence before use, then copy its compatible files here.


The project `.gitignore` excludes files under this directory by default to avoid accidentally committing multi-gigabyte model weights. Keep models on the local device unless you deliberately choose to host/share them and have checked repository limits and model redistribution terms.
