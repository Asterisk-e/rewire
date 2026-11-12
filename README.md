# Local Studio 2.0

Local Studio is an offline-first chat workspace for local AI models. It supports two inference routes:

1. **Browser models:** compatible Hugging Face Transformers.js / ONNX models run inside the browser using WebGPU when supported, otherwise WebAssembly. Prompts, audio and inference stay in the browser. Remote model downloads are disabled.
2. **Local server models:** connect to one or more OpenAI-compatible inference servers on the same device or trusted private LAN. Examples include local inference applications that expose `/v1/models` and `/v1/chat/completions`.

The app also includes draggable capability cards, multi-model selection, adjustable Wire Strength, local Whisper-style speech transcription, voice conversation mode, a PWA app-shell cache, and explicit code-file saving.

## What “offline” means

The application itself makes no calls to cloud AI services, analytics services, remote font providers or external asset CDNs. Browser inference uses local model files and a locally prepared copy of the Transformers.js runtime. The service worker caches the app shell and model/runtime files as they are first used.

A fresh installation still needs a **one-time preparation step** while online (or with dependencies copied in from another machine):

- Install the Python packages listed in `backend/requirements.txt`.
- Install the browser runtime dependency with `npm install`, then run `npm run prepare:offline`.
- Obtain compatible ONNX model files and copy them into `models/`.
- Obtain a compatible speech-recognition model if you want Transcribe or Voice mode.

After those pieces are installed, browser inference and local speech transcription can operate without internet. Model files are intentionally not bundled: they are large, and model licences differ. Read each model's licence before using or redistributing it.

## 1. Run on Fedora Linux

Extract the ZIP, open a terminal in the `local-model-studio` folder, and prepare the Python backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Prepare the browser runtime while internet is available:

```bash
npm install
npm run prepare:offline
```

Keep the generated `vendor/` files. They are required for browser inference while offline. The dependency installation step is only for preparing this local runtime; the running app does not load JavaScript from a CDN.

Start Local Studio:

```bash
source .venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. Keep this local server running while you use the app. The same local server serves the frontend, model files and workspace API.

To stop it, press `Ctrl+C` in the terminal.

## 2. Run a model directly in the browser

Local Studio uses the Hugging Face Transformers.js browser runtime. It does not download a model automatically and does not contact the Hugging Face Hub at runtime.

### Model file layout

Create a directory under `models/` for each compatible model. For example:

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

The precise files vary by model. Use a repository/export that provides **Transformers.js-compatible ONNX weights**. Standard PyTorch `.safetensors` or `.bin` weights alone are not enough for this browser runtime. Some model exports use different ONNX filenames or subfolders; preserve the model's folder structure.

### Register the model

1. Start Local Studio or open the installed/cached PWA.
2. Select **Manage** beside Models.
3. Under **Browser models**, choose **Import folder from device** and select the model directory. The browser copies the files into its origin-scoped Cache Storage under the app's origin; files are not uploaded to GitHub or another server.
4. The imported model is registered automatically. Select it from the sidebar.

For a model folder already present under the project's `models/` directory, enter its display name and folder name, then choose **Add folder from models/** instead. The import option is especially useful with GitHub Pages: model weights do not need to be committed to the repository.

The first load can take time because the browser must read and initialise the model. Large models may exceed the memory or storage available to your browser. Start with a small instruction-tuned ONNX model. WebGPU acceleration is preferred when enabled and available; Local Studio falls back to WebAssembly where it can.

### Offline caching

The service worker caches `/vendor/` runtime assets and `/models/` assets when the browser first fetches them. When you import a folder from your device, the model files are placed directly into the same local browser cache so a GitHub Pages frontend can load them without committing weights to Git. Browser cache quota varies by browser and device. Keep a backup of the original model files because clearing site data removes the browser's imported copy.

## 3. Multiple local API models

There are two ways to use local API models.

### Add directly in the browser

1. Open **Manage → Local server models**.
2. Enter the local inference server's base URL, ending in `/v1` (for example `http://127.0.0.1:1234/v1`).
3. Add an API key only if your local server requires one.
4. Select **Discover server models**.
5. Select any discovered model from the sidebar.

The browser sends prompts directly to that endpoint. The endpoint must allow requests from the Local Studio page through CORS. This route is suitable for localhost and trusted private-LAN model servers. A local endpoint may not be reachable from a GitHub Pages-hosted HTTPS page because of browser mixed-content and private-network restrictions; for the simplest setup, run the frontend and model server on the same device or use the local FastAPI-hosted page.

### Configure several models through the Python backend

Edit `backend/.env` and set `MODEL_PROFILES_JSON` to a JSON array. Example:

```dotenv
MODEL_PROFILES_JSON=[{"id":"qwen","name":"Qwen local","base_url":"http://127.0.0.1:1234/v1","model":"qwen-local","api_key":""},{"id":"llama","name":"Llama local","base_url":"http://127.0.0.1:8080/v1","model":"llama-local","api_key":""}]
```

`MODEL_PROFILES_JSON` takes precedence over the single-model variables. Restart Uvicorn after editing `.env`. Configured profiles appear in the model list automatically.

Legacy single-model configuration is still supported:

```dotenv
MODEL_BASE_URL=http://127.0.0.1:1234/v1
MODEL_API_KEY=
MODEL_NAME=local-model
```

Do not put cloud API endpoints in these settings if you require offline operation. API keys stored in the browser model manager are held in that browser's local storage; use this only on a device and browser profile you control.

## 4. Voice and transcription

Local Studio provides two modes:

- **Transcribe:** record speech, transcribe it with a local model, and place the text in the composer. The user can edit it before sending.
- **Voice:** record one utterance, transcribe it locally, send it to the selected chat model, then speak the response using an installed local system voice. Repeat for the next turn.

This is turn-based voice chat rather than continuous full-duplex audio. It does not use cloud speech recognition. The microphone requires browser permission and a secure context (localhost is treated as secure by modern browsers).

To enable speech:

1. Obtain a compatible Transformers.js ONNX speech-recognition model (such as a Whisper export) with its tokenizer and configuration.
2. Put it in its own folder under `models/`.
3. Open **Settings** and enter that folder name in **Local transcription model folder**.
4. Open **Voice → Transcribe** or **Voice → Voice**.

Voice responses use the browser's speech synthesis interface, but Local Studio selects only a voice marked as a local system voice. Availability depends on the OS and installed offline voice packs. If no local voice is available, text responses still work, but spoken output is unavailable until an offline voice pack is installed.

Audio is recorded in the browser and decoded locally before being passed to the selected speech model. It is not uploaded by Local Studio.

## 5. Wire Strength

Wire Strength changes the system instruction and generation limits sent to the selected model. It is a prompt/generation preset, not a guarantee that the model has more compute or better reasoning. A small model may not benefit much from high settings.

| Value | Preset | Intended behaviour |
|---:|---|---|
| 0.3 | Low | Quickest, shortest useful answers |
| 0.5 | Quick | Simple, short answers with essential context |
| 1 | Normal | Balanced reasoning and detail |
| 2 | Medium | More careful refinement, approximately Normal response length |
| 3 | High | More validation, edge-case checks and somewhat longer responses |
| 4 | Very High | More structured, complete and refined responses |
| 5 | Extreme | Strongest available refinement, more comprehensive output and checks |

Because the app is offline, High and above cannot perform live internet research. They can only analyse the prompt, conversation and tools/data made available locally. The model should not expose private chain-of-thought; it should provide conclusions and concise rationale.

## 6. Capability cards

The cards (HTML, CSS, JavaScript, Python, Code Review and Accessibility) add task-specific instructions to the model's system prompt. They do not grant new abilities or filesystem access. The backend validates capability IDs when using the backend API; browser model prompts are assembled in the browser.

## 7. Saving generated code

Code blocks have an explicit **Save code** action. When the local backend is connected, files are written under `workspace/` after the user chooses a path and confirms any overwrite. Without the backend, the browser downloads the code as a text file. Generated code is never executed. The backend rejects absolute paths, traversal, hidden paths, symlinks and file extensions outside its allowlist.

## 8. GitHub Pages and offline use

GitHub Pages can host the static frontend, but it cannot run FastAPI. It can serve the cached PWA shell and runtime. Use **Import folder from device** to copy model weights from the device into that browser's private cache without publishing them in the repository. The first visit and runtime setup must happen while online; model imports are local and can then be used offline. Clearing the browser's site data removes the imported models.

For fully local inference on Fedora, the recommended arrangement is to run Local Studio at `http://127.0.0.1:8000`. You can also use the static GitHub Pages frontend after its first visit, provided you have prepared the runtime, imported the models on that device, and the browser has retained its app/model caches.

## 9. Security and privacy notes

- No cloud model API or external asset CDN is configured by default.
- Local server models should use `localhost` or a trusted private network.
- The Studio bearer token protects backend routes but does not replace a firewall or secure network configuration.
- Browser API keys added in the model manager are stored locally in the browser profile; do not use this with a shared browser account.
- Model files are untrusted code/data. Use reputable model exports and read their licences.
- The workspace is not a security boundary against another person who already has OS access to the device.
- Local Studio does not provide a terminal tool or execute model-generated code.

## Project structure

```text
local-model-studio/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── assets/
│   ├── app.js
│   ├── styles.css
│   └── favicon.svg
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── models/
│   └── README.md
├── vendor/                 # Created by npm run prepare:offline
├── tools/
│   └── prepare-runtime.mjs
├── package.json
├── workspace/
└── README.md
```

## Troubleshooting

- **Browser runtime missing:** run `npm install` and `npm run prepare:offline`, then reload.
- **Model folder not found:** check its spelling and that it exists beneath `models/`.
- **Unsupported model:** the folder needs a Transformers.js-compatible ONNX export; ordinary PyTorch checkpoints do not load directly.
- **WebGPU failure:** turn off Prefer WebGPU in Settings or allow the fallback to WebAssembly. Some devices/browsers cannot run all model architectures.
- **Not enough memory:** use a smaller or more quantised model and close other tabs.
- **No transcription:** check the speech-model folder, browser microphone permission and model compatibility.
- **Voice replies are silent:** install an offline OS voice pack; Local Studio intentionally avoids non-local voices.
- **Local server discovery fails:** check the `/v1/models` endpoint, CORS settings and whether the endpoint is on localhost/private LAN.
- **No backend models appear:** check `backend/.env`, restart Uvicorn, then reload the app.
