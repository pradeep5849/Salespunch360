# Quotation PDF fonts

These unmodified Noto fonts are redistributed under the SIL Open Font License in
[OFL.txt](OFL.txt). They provide Latin/Cyrillic/Greek, Devanagari and Kannada
coverage for customer quotation content. PDF fonts are embedded as subsets.

Downloaded from the `notofonts/noto-fonts` repository:

| File | Source path under `hinted/ttf` | SHA-256 |
| --- | --- | --- |
| NotoSans-Regular.ttf | NotoSans/NotoSans-Regular.ttf | b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5 |
| NotoSansDevanagari-Regular.ttf | NotoSansDevanagari/NotoSansDevanagari-Regular.ttf | 385e78e6359a9d88a0f243d53b1209d7548361ba2194e2b9ec779bcaa7e8949d |
| NotoSansKannada-Regular.ttf | NotoSansKannada/NotoSansKannada-Regular.ttf | 5c804033c57f2c2844b1cd425f45b9a78d81d2f71bf358351b24258ebe168aea |

Font coverage is checked before drawing. Unsupported characters raise an error;
the renderer never replaces customer text with question marks. Deployment tracing
includes these font files. No font is loaded from a network during PDF generation.
