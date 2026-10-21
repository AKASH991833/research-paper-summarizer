# Research Paper Summarizer - Python (scikit-learn)

The pro-grade version of the browser demo: TextRank-style extractive summarization with real sentence-graph centrality, section detection, keyword extraction and contribution heuristics. Fully offline.

## Stack

- **scikit-learn TF-IDF** - 1-2 gram sentence vectors with sublinear TF
- **TextRank centrality** - power method over the cosine similarity graph (damping 0.85)
- **MMR selection** - greedy redundancy-penalized pick, sentences returned in original order
- **Section + keyword layers** - canonical section heads (abstract/methods/results...), corpus-level TF-IDF keywords, contribution sentence patterns
- **Streamlit** - paste text, length slider, summary, keywords, contributions, section browser

## Run locally

```
pip install -r requirements.txt
streamlit run app.py
```

## Tests

```
python3 tests/test_paper_summarizer.py     # or: python3 -m pytest tests/ -q
```

Covers key-sentence recall, section detection, keyword relevance, contribution extraction, dedup, sentence splitting and short-input rejection.

## Honest limits

- Extractive summaries copy sentences verbatim; they do not paraphrase like an LLM.
- Section detection expects common heading styles; OCR-damaged text can break it.
- No citation graph or PDF parsing here - paste plain text.

## Layout

- `paper_summarizer.py` - pure logic (no Streamlit imports), fully unit tested
- `app.py` - Streamlit UI
- `tests/test_paper_summarizer.py` - unit tests
