# Lorenzo’s Portfolio

Su desktop il portfolio si apre nella vista dell’ufficio. Clicca sulla zona di una sezione per aprire la sua prima tappa, poi scorri per avanzare o tornare indietro tra le schede. Puoi anche usare le frecce su e giù o i tasti Page Up e Page Down. About Me segue cinque tappe, tre delle quali affiancano foglio e foto nella stessa inquadratura.

Apri `index.html` in un browser per vedere la prova. È una pagina statica con font e immagine salvati nella repo.

Su mobile si parte da **Work & Projects**, al centro della lavagna. Scorri per spostarti tra le colonne e premi **Explore** per visitare le schede di quella attiva. Il prototipo a scorrimento verticale completo è disponibile su `index.html?mobile=list`.

- `index.html` contiene titoli, fogli, coordinate e ordine di visita.
- `styles.css` calibra la superficie della lavagna sulla foto e definisce tipografia, colori e materiali.
- `board.js` muove la camera sull’intera scena.
- `assets/` contiene l’immagine JPEG usata dal sito, l’originale PNG e i font Caveat Brush e Caveat con le rispettive licenze SIL Open Font License.

## Piazzare un foglio

La superficie scrivibile misura **1230 × 676** unità, con origine nell’angolo interno in alto a sinistra. Un’unità corrisponde a un pixel nella foto originale. La classe `.board` in `styles.css` fissa il rettangolo sulla foto.

- Apri `index.html?grid=1` per vedere la griglia. Passa il puntatore sulla lavagna per leggere le coordinate, anche durante lo zoom.
- Imposta `--x` e `--y` sul foglio o sulla polaroid in `index.html` per posizionarne l’angolo in alto a sinistra. Puoi anche regolare `--angle` e `--width`.
- Per aggiungere una foto, usa un `img.polaroid-photo` con testo alternativo dentro una cornice `.polaroid`. Con `--photo-ratio` puoi adattare la cornice alle immagini orizzontali o verticali.
- Gli elementi con `data-stop` sono le tappe del percorso, nell’ordine in cui compaiono nella sezione. Un gruppo `.board-pair` ha coordinate proprie e tiene foglio e foto nella stessa tappa.

Per collegare una repo GitHub vuota, copia il suo URL HTTPS, sostituiscilo a `URL_DELLA_REPO` ed esegui questi comandi da questa cartella.

```sh
git remote add origin URL_DELLA_REPO
git push -u origin main
```
