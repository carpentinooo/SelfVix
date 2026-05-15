# 🚀 Deploy su BeamUp (Stremio) via GitHub Actions

Questa guida ti spiega come configurare il deploy automatico su **BeamUp** sfruttando la GitHub Action ufficiale di Stremio.

> [!WARNING]
> **SE HAI FATTO UN FORK DI QUESTO REPOSITORY:**
> GitHub disabilita le Actions per impostazione predefinita per motivi di sicurezza. 
> Prima di fare qualsiasi cosa, clicca sulla scheda **"Actions"** in alto e premi il pulsante verde **"I understand my workflows, go ahead and enable them"** (Abilita i workflow). Se non lo fai, i metodi qui sotto non funzioneranno!

## 🛠️ Configurazione Iniziale

### 1. Generazione delle Chiavi SSH (Importante)
BeamUp richiede una chiave SSH per autorizzare i tuoi push. Scegli il metodo più comodo per te:

#### Metodo A: Senza PC (Più Facile - Anche da Telefono) 📱
Ho creato un generatore automatico per te:
1.  Vai sulla scheda **"Actions"** del tuo repository su GitHub.
2.  Nel menu a sinistra, clicca su **"Generatore Chiavi SSH (BeamUp)"**.
3.  Clicca sul pulsante grigio **"Run workflow"** e poi su **"Run workflow"** (verde).
4.  Attendi qualche secondo che l'azione finisca (cerchio verde).
5.  Clicca sul nome dell'azione appena terminata e apri lo step **"📋 COPIA LE TUE CHIAVI"**.
6.  Troverai due blocchi:
    -   **Chiave PUBBLICA**: Copiala e incollala nel tuo **Profilo GitHub** (**Settings > SSH and GPG keys > New SSH key**).
    -   **Chiave PRIVATA**: Copiala e incollala nei **Secret del Repository** (**Settings > Secrets > Actions > New repository secret**) chiamandolo `SSH_PRIVATE_KEY`.

#### Metodo B: Da Terminale PER UTENTI ESPERTI (Se hai un PC/Raspberry) 💻
1.  **Genera la chiave**:
    ```bash
    ssh-keygen -t ed25519 -C "tua-email@github.com"
    ```
    - Premi invio per salvare nel percorso predefinito (es. `~/.ssh/id_ed25519`).
    - Non impostare una passphrase (lascia vuoto).

2.  **Aggiungi la Chiave Pubblica a GitHub**:
    - Copia il contenuto del file `.pub` (es. `cat ~/.ssh/id_ed25519.pub`).
    - Vai sul tuo profilo personale GitHub -> **Settings > SSH and GPG keys > New SSH key**.
    - Incolla la chiave e salva.

### 2. Configurazione dei Secret nel Repository
Vai sul tuo repository GitHub dell'addon -> **Settings > Secrets and variables > Actions** e aggiungi questi tre "Repository secrets":

1.  **`SSH_PRIVATE_KEY`**: Copia e incolla l'intero contenuto della tua **chiave privata** (il file senza `.pub`, es. `cat ~/.ssh/id_ed25519`). Deve includere `-----BEGIN OPENSSH PRIVATE KEY-----` e la fine.
2.  **`USERNAME_GITHUB`**: Inserisci il tuo nome utente GitHub (es. `TUOUSER`).
3.  **`PROJECT_NAME`**: Scegli un nome per il tuo addon (es. `TUO_USERNAME`). RICORDALO!!! Questo determinerà l'URL finale, quindi mettilo UNIVOCO: `https://TUO_PROGETTO.baby-beamup.club/manifest.json`.

---

## 🚀 Come fare il Deploy

Una volta configurati i Secret, ogni volta che farai un **Git Push** sul ramo `main`, GitHub avvierà automaticamente l'azione di deploy.

### Monitoraggio
Puoi seguire l'avanzamento nella scheda **"Actions"** del tuo repository su GitHub. Se tutto va a buon fine, il tuo addon sarà attivo in pochi minuti.

## 🔗 URL dell'Addon
Dopo il primo deploy riuscito, l'addon sarà accessibile su:
`https://[IL-TUO-PROJECT-NAME].baby-beamup.club/manifest.json`

## ⚠️ Note Tecniche
- BeamUp è un server basato su **Dokku**. 
- L'addon deve ascoltare sulla porta fornita dalla variabile d'ambiente `PORT` (già configurato in `addon.ts`).
- Se il deploy fallisce, controlla nei log delle Actions che la chiave SSH sia stata copiata correttamente senza spazi extra.
