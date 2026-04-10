export function generateLandingPage(manifest: any, addonBase: string): string {
    const installUrl = `stremio://${addonBase.replace(/^https?:\/\//, '')}/manifest.json`;
    const manifestUrl = `${addonBase}/manifest.json`;

    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${manifest.name} - Installazione</title>
        <link rel="icon" href="${manifest.logo}">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #8A5AAB;
                --primary-hover: #724191;
                --bg: #0f0f12;
                --glass: rgba(255, 255, 255, 0.05);
                --glass-border: rgba(255, 255, 255, 0.1);
                --text: #ffffff;
                --text-muted: rgba(255, 255, 255, 0.7);
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            body {
                font-family: 'Inter', sans-serif;
                background-color: var(--bg);
                background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('https://i.imgur.com/ebLhy9z.jpeg');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                color: var(--text);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow-x: hidden;
            }

            .container {
                width: 100%;
                max-width: 500px;
                padding: 40px 20px;
                animation: fadeIn 0.8s ease-out;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .card {
                background: var(--glass);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border);
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
            }

            .logo {
                width: 120px;
                height: 120px;
                border-radius: 20%;
                margin: 0 auto 24px;
                display: block;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }

            h1 {
                font-family: 'Outfit', sans-serif;
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
                background: linear-gradient(135deg, #fff 0%, #aaa 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .version {
                font-size: 14px;
                color: var(--text-muted);
                background: var(--glass-border);
                padding: 2px 10px;
                border-radius: 12px;
                display: inline-block;
                margin-bottom: 20px;
            }

            p.description {
                font-size: 16px;
                color: var(--text-muted);
                line-height: 1.6;
                margin-bottom: 32px;
            }

            .button-group {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 14px 28px;
                border-radius: 14px;
                font-size: 16px;
                font-weight: 600;
                text-decoration: none;
                transition: all 0.3s ease;
                cursor: pointer;
                border: none;
                width: 100%;
            }

            .btn-primary {
                background-color: var(--primary);
                color: white;
            }

            .btn-primary:hover {
                background-color: var(--primary-hover);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(138, 90, 171, 0.4);
            }

            .btn-secondary {
                background-color: var(--glass-border);
                color: white;
            }

            .btn-secondary:hover {
                background-color: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
            }

            .btn-kofi {
                background-color: #29abe0;
                color: white;
            }

            .btn-kofi:hover {
                background-color: #2291be;
                transform: translateY(-2px);
            }

            .custom-kofi-union {
                background: #FF5E5B;
                color: white;
                text-decoration: none;
                padding: 12px 20px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: transform 0.2s;
                font-weight: 600;
            }

            .custom-kofi-union:hover {
                transform: scale(1.02);
                background: #ff4d4a;
            }

            .custom-kofi-union img {
                height: 24px;
            }

            .toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(138, 90, 171, 0.9);
                color: white;
                padding: 10px 24px;
                border-radius: 50px;
                font-weight: 500;
                transition: transform 0.3s ease-out;
                z-index: 1000;
                backdrop-filter: blur(10px);
            }

            .toast.show {
                transform: translateX(-50%) translateY(0);
            }

            @media (max-width: 480px) {
                .card { padding: 30px 20px; }
                h1 { font-size: 28px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <img src="${manifest.logo}" alt="Logo" class="logo">
                <h1>${manifest.name}</h1>
                <span class="version">v${manifest.version}</span>
                <p class="description">${manifest.description}</p>
                
                <div class="button-group">
                    <a href="${installUrl}" class="btn btn-primary" id="install_button">Installa Addon</a>

                    <a href="https://ko-fi.com/G2G41MG3ZN" target="_blank" class="custom-kofi-union">
                        <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-fi">
                        <span>Un Grog per noi 🍻</span>
                    </a>

                    <button class="btn btn-secondary" onclick="copyManifest()">Copia Link Manifest</button>
                </div>
            </div>
        </div>

        <div id="toast" class="toast">Link copiato negli appunti!</div>

        <script>
            function copyManifest() {
                const url = "${manifestUrl}";
                navigator.clipboard.writeText(url).then(() => {
                    const toast = document.getElementById('toast');
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 2000);
                });
            }

            // Fallback per browser che non supportano stremio://
            document.getElementById('install_button').addEventListener('click', (e) => {
                setTimeout(() => {
                    if (document.hasFocus()) {
                        // Se la finestra ha ancora il focus dopo 2 secondi, 
                        // probabilmente l'app Stremio non è installata o non ha intercettato il link
                        console.log("Install link clicked");
                    }
                }, 2000);
            });
        </script>
    </body>
    </html>
    `;
}
