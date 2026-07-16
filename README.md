# TheodoreWolf.github.io

Theo Wolf's personal academic website. It is a plain HTML, CSS, and JavaScript
site with no build step.

## Local preview

```sh
uv run python -m http.server 4173 --directory site
```

Then open <http://localhost:4173/>.

## Deployment

Pushing `site/` changes to `master` deploys the directory directly through
GitHub Pages. The repository's Pages source must be set to **GitHub Actions** in
Settings → Pages.

The previous al-folio/Jekyll implementation is preserved by the
`legacy-al-folio` tag.
