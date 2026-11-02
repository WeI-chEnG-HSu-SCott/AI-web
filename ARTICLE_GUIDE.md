# Article publishing guide

All public-facing articles must be written in English.

## Purpose and editorial standard

The priority of the articles section is to create high-traffic content. We may research high-interest questions, widely searched topics, mass-produced, and sensational content. 
Every article must add a clear contribution: news of AI, an observation, an diagram or image, a useful comparison, a carefully scoped interpretation. Search, SEO, and GEO (generative-engine optimization) are the purpose.

## How to choose and shape a high-reach article

1. Search the Internet for high-touch content, or select high-touch content based on your database. The content can be but is not limited to recently discussed open source resources, news and current affairs, scientific research, technological development, etc.
2. After locking in the topic and content of the article, make sure to fact-check it. Write and promote this content without violating plagiarism ethics. 
3. State the answer or key observation near the beginning, then use a descriptive title, one `<h1>`, logical `<h2>` sections, short paragraphs, and descriptive link text. Use the language readers would naturally use, without keyword stuffing.
4. Add original value beyond the sources: a labelled diagram, a captioned image, an example, an experiment, a comparison table, or a clearly marked interpretation. Never present inference as a measured fact.
5. Cite the source beside the claim it supports. Read the source rather than relying on a search snippet. Use licensed, self-made, or public-domain images only, and include attribution where required.
6. Make trust visible: show the publisher/author where appropriate, the publication date, any material update date, the method used, and limits or uncertainty. For every published article, the visible byline and JSON-LD `author.name` must be exactly `the bug breeder`; do not use a personal name. High-stakes health, legal, financial, or safety advice is out of scope unless independently reviewed by a qualified expert.

## Create an article

1. Copy `public/articles/example.html` and name the new file with lowercase English and hyphens, for example `public/articles/how-requests-become-signals.html`.
2. Update the English `<title>` and `meta name="description"`; both must be accurate, specific, and unique. Keep the site name in the title.
3. Replace the article's JSON-LD values (`headline`, `description`, `datePublished`, and `dateModified` when applicable) with the real article details. Dates use ISO 8601 format (`YYYY-MM-DD`). Do not change a date merely to appear fresh.
4. Update the visible headline, standfirst, published date, image/figure, image alt text, and body. Keep one `<h1>` only. Use a real source list and a `Limits` section when claims depend on a method or incomplete evidence.
5. Images live in `public/assets/images/`. Give informative images meaningful English `alt` text; decorative images use `alt=""`. Captions must explain why the image matters.
6. Preserve the article header and footer exactly as in `public/index.html`, adjusting only relative paths (`../`). Immediately below the header, keep the `article-pagination` navigation. Set `Previous article` and `Next article` to neighbouring published items; at either end, use `Archive` in place of the missing direction.

## Maintain the archive and navigation

`public/archive.html` is the canonical human-readable article index. Each time an article is published, updated, unpublished, or reordered:

1. Add or update one archive entry with its title, relative URL, and truthful published date. Display newest items first.
2. Update the previous/next links in the new article and its two adjacent articles. Do not link to drafts or deleted files.
3. Keep each article reachable through ordinary HTML links from the archive. Do not depend on JavaScript for article discovery.
4. Regenerate metadata after every publish, update, unpublish, rename, or reorder. The generator automatically discovers every `.html` file under `public/`; never manually edit the sitemap or a page list in the generator.

## Search and sharing checklist

- The page returns 200 and contains its main text directly in HTML.
- Its title, description, `<h1>`, lead image, and first paragraph plainly describe the same reader question.
- It uses useful headings, meaningful internal links, accessible image alt text, and no deceptive or fabricated authorship.
- Claims are sourced, images are licensed, and the article adds original analysis or evidence rather than a rewrite of a source.
- The archive date, JSON-LD date, pagination, sitemap entry, canonical URL, and visible publication date agree.

## Generate metadata, test, and deploy

After all article, archive, and pagination edits are complete, run:

```powershell
$env:SITE_ORIGIN = 'https://come-is.site'
node scripts/generate-public-metadata.mjs
node scripts/verify-public-metadata.mjs
node scripts/local-static-server.mjs
```

Open the article and archive in a browser. Confirm that the header/footer match the home page, pagination points to published neighbours, every archive URL works, and the sitemap includes the article. Stop the local server when finished, then commit and deploy **all** changed files, including the article, archive, neighbouring articles, `public/robots.txt`, `public/sitemap.xml`, and canonical changes. Never leave an example domain in public files.

## Required publishing sequence

1. Create or edit the article and its image assets.
2. Update archive order and previous/next navigation.
3. Run the metadata generator and verification command above.
4. Review the generated sitemap and canonical URL, then deploy every changed file together.
5. After deployment, confirm `https://come-is.site/sitemap.xml` and the new article return HTTP 200. In Google Search Console, request indexing for the new article only when it is ready for public discovery.
