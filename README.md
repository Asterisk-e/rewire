# Local Studio

A starter web interface for chatting with an OpenAI-compatible local model. Users can drag capability cards into the composer to add task-specific instructions to the model's system prompt. The Python backend keeps those instructions out of the visible chat transcript and forwards requests to the configured model endpoint.

## Included

- Claude-inspired two-column chat workspace.
- Drag-and-drop and click-to-toggle capability cards: HTML, CSS, JavaScript, Python, Code Review, and Accessibility.
- Capability instructions are added server-side to the system prompt for each request.
- OpenAI-compatible chat-completions connector with configurable URL, model name, and API key.
- Connection settings for the Studio backend URL and an optional Studio access token.
- Code-block rendering with an explicit **Save to workspace** action.
- Restricted text workspace: files are saved only after a user action, within `workspace/`, and only for a small allowlist of file extensions.
- Conversation history and selected cards are stored in the current browser's local storage.
- No shell tool, no code execution, and no automatic file deletion.

## 1. Run locally on Fedora Linux

Open a terminal in the extracted project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` and configure the model endpoint:

```dotenv
MODEL_BASE_URL=http://127.0.0.1:PORT/v1
MODEL_API_KEY=
MODEL_NAME=the-model-id-served-by-your-api
```

Replace the example host, port, and model ID with the values provided by the local inference server you are using. `MODEL_BASE_URL` must be the API base URL and should end in `/v1`; do not append `/chat/completions`.

Start Local Studio:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000> in your browser. The site and API are served by the same local process.

To stop the server, press `Ctrl+C` in the terminal.

## 2. Connect PocketPal

Local Studio currently uses the **OpenAI-compatible chat-completions API shape**:

- `GET {MODEL_BASE_URL}/models`
- `POST {MODEL_BASE_URL}/chat/completions`

PocketPal's availability and exact URL depend on the PocketPal version and whether that version exposes a local or network server. Do not assume that a model being loaded in PocketPal automatically means an HTTP API is available.

If your PocketPal version exposes an OpenAI-compatible server, set `MODEL_BASE_URL` to that server's base URL and set `MODEL_NAME` to the model ID it serves. Restart the Local Studio backend after changing `backend/.env`.

If PocketPal does not expose a compatible endpoint, this project will need a separate supported bridge or inference server. The frontend does not bypass PocketPal's app permissions or communicate with its private app storage.

## 3. Host the frontend on GitHub Pages

GitHub Pages can host the static interface, but it cannot run the Python backend. Keep the `backend/` service running separately on a device or server that can reach your model.

1. Create a GitHub repository and upload the contents of this project.
2. In the repository's **Settings → Pages**, choose the branch and folder containing `index.html`.
3. Wait for GitHub Pages to publish the site.
4. Run the Python backend on the device that can reach the model API.
5. In `backend/.env`, set `CORS_ORIGINS` to the exact origin of your GitHub Pages site. For example:

   ```dotenv
   CORS_ORIGINS=https://YOUR-USERNAME.github.io
   ```

   If your site is `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`, the origin is still `https://YOUR-USERNAME.github.io` (no repository path).

6. For a public or cross-network website, make the backend available through **HTTPS** using a properly secured reverse proxy or private access solution. Browsers generally block an HTTPS GitHub Pages site from calling an ordinary HTTP server on another device.
7. Set a long random `STUDIO_ACCESS_TOKEN` in `backend/.env`, restart the backend, then open **Connection settings** in the website. Enter the backend's HTTPS URL and the same Studio access token, then press **Test**.

Do not expose the backend directly to the public internet without HTTPS and an access token. The token protects API access; it does not replace network-level security or rate limiting.

## 4. Use from another device on your local network

For a temporary private-LAN setup, the backend must listen on a network interface:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Then:

- Set `STUDIO_ACCESS_TOKEN` to a long random value.
- Set `CORS_ORIGINS` to the exact website origin (or the exact local origin used by the browser).
- Allow the backend port through the host firewall only on the trusted private network.
- In the browser on the other device, open the website and enter the backend device's LAN address, such as `http://192.168.x.x:8000`, plus the access token.

This plain-HTTP LAN option is for a trusted private network only. It is not suitable for a public website. If the page itself is hosted on GitHub Pages over HTTPS, use an HTTPS backend address instead.

## 5. Configuration reference

| Variable | Purpose |
|---|---|
| `MODEL_BASE_URL` | OpenAI-compatible API base URL ending in `/v1` |
| `MODEL_API_KEY` | Optional model-server API key; stored on the backend only |
| `MODEL_NAME` | Model ID expected by the inference API |
| `STUDIO_ACCESS_TOKEN` | Optional bearer token protecting the Studio API; strongly recommended beyond localhost |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins |
| `WORKSPACE_DIR` | Optional path for user-saved code files; defaults to `./workspace` |

After changing `backend/.env`, restart Uvicorn for the changes to take effect.

## 6. Capability cards

The built-in cards are defined in two places:

- `assets/app.js`: labels and presentation in the browser.
- `backend/main.py`: trusted capability instructions that are inserted into the system message.

When adding a new card, add a matching ID and instruction in both places. The backend accepts only IDs in its allowlist; the browser cannot send arbitrary system instructions.

These cards guide the model; they do not grant new abilities. For example, the HTML card does not itself give the model filesystem access. File saving is a separate, explicit user action performed by the website.

## 7. Workspace safety

Generated code is displayed as text. The application does not execute it, run shell commands, or automatically alter existing files. A user must press **Save to workspace** and confirm replacement of an existing file. The backend rejects absolute paths, parent-directory traversal, hidden paths, symlinks, and file extensions outside its allowlist. There is no file-delete endpoint.

The workspace is not a security boundary against a person who already has operating-system access to the machine. Do not use it to store secrets.

## Troubleshooting

- **Backend unavailable:** Check that Uvicorn is running and that the website's backend URL is correct.
- **CORS error:** Add the exact webpage origin to `CORS_ORIGINS`, restart Uvicorn, and reload the page.
- **401 response:** Enter the same `STUDIO_ACCESS_TOKEN` configured in `backend/.env`.
- **Model endpoint not configured:** Set `MODEL_BASE_URL` in `backend/.env` and restart Uvicorn.
- **Model endpoint error:** Verify that the endpoint exposes `/chat/completions`, that the model ID is correct, and that any required API key is configured.
- **GitHub Pages cannot reach a local HTTP backend:** Use the locally hosted frontend for local development, or provide a reachable HTTPS backend for the published site.

## Project layout

```text
local-model-studio/
├── index.html
├── assets/
│   ├── app.js
│   └── styles.css
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── workspace/
│   └── .gitkeep
├── .gitignore
└── README.md
```
