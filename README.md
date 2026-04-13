# SelfVix🤌 Addon 

Addon leggero e standalone per Stremio che estrae e riproduce contenuti da VixSrc e VixCloud con proxy HLS integrato e logica "Synthetic FHD".

## Funzionalità
- **Branding Personalizzato**: Nome `SelfVix🤌` e logo personalizzato.
- **Proxy HLS Automatico**: Tutti i flussi passano attraverso il server dell'addon per bypassare restrizioni di IP e geolocalizzazione (ideale per Render/HuggingFace).
- **Synthetic FHD**: Il proxy riscrive il manifest per servire solo la qualità video migliore (1080p), mantenendo tutte le tracce audio e i sottotitoli.
- **Supporto Anime (Kitsu)**: Integrazione completa con le api di Kitsu
- **ID Agnostico**: Funziona correttamente con ID TMDB (`786892`), IMDB (`tt30144839`) e Kitsu (`kitsu:12:1`).

## Naming degli Stream
- **Film/Serie**: Provider `SC 🤌`, Titolo `VIX 1080 🤌`.
- **Anime**: Provider `AU 🤌`, Titolo `VIX 1080 🤌`.

---

## Istruzioni per il Deploy

PRIMA DI TUTTO FARE IL FORK E MODIFICARE IL DOCKER FILE:

[VIDEO
](https://www.youtube.com/watch?v=nnhwo0C5x3I
)

### 1. Deploy su Koyeb (Scelta consigliata per stabilità)

[VIDEO
](https://www.youtube.com/watch?v=IXEi81ONdNo
)

Koyeb è un'ottima alternativa a Render, più veloce e senza il "periodo di sospensione" (sleep) del piano gratuito.

1.  Crea un account su [Koyeb.com](https://www.koyeb.com/).
2.  Clicca su **"Create Service"** e seleziona **GitHub**.
3.  Collega il tuo repository `SelfVix`.
4.  Nelle impostazioni di configurazione:
    -   **Builder**: Assicurati che sia selezionato `Docker`.
    -   **Dockerfile Path**: Inserisci `Dockerfile.hf` (o il nome del file che hai usato).
    -   **Port**: Imposta `7000`.
5.  Clicca su **Deploy**. L'addon sarà online in pochi minuti.



### 2. Deploy su Hugging Face Spaces (Gratuito)

[VIDEO
](https://www.youtube.com/watch?v=Ti2BNDjm0ns
)

Ottimo come backup gratuito.

1.  Crea un nuovo **Space** su [Hugging Face](https://huggingface.co/spaces).
2.  Scegli **Docker** come SDK e il template **Blank**.
3.  Carica il dockerfile come da video, FATE IL FORK DEL PROGETTO E RINOMINATE DOCKER.HF con il vostro user GITHUB!).
4.  Prendere il link embed!
5.  Lo Space si avvierà automaticamente sulla porta `7860`.

### 3. Deploy su Vercel (Velocissimo)

[VIDEO
](https://www.youtube.com/watch?v=TP3_sbt94Ag&feature=youtu.be)

Dato che il progetto include i file `vercel.json` e `api/index.ts`, puoi ospitarlo come Serverless Function.

1.  Vai su [Vercel.com](https://vercel.com/) e importa il tuo repository GitHub.
2.  Vercel rileverà automaticamente la configurazione.
3.  Clicca su **Deploy**.
4.  L'addon sarà accessibile su `https://tua-app.vercel.app/manifest.json`.


---

## Sviluppo Locale

Se vuoi testare l'addon in locale sul tuo PC o Raspberry Pi:

```bash
# Installa le dipendenze
npm install

# Compila e avvia
npm run build
npm start

# Oppure via dev (ts-node)
npm run dev
```

L'addon sarà accessibile su `http://localhost:7000`.

---

## Note Tecniche
L'addon utilizza **AnimeMapping** per convertire gli ID di Kitsu nei percorsi corrispondenti di AnimeUnity, garantendo che anche gli anime siano sempre aggiornati e riproducibili via VixCloud.
