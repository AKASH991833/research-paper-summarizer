"""Research paper summarization logic - no UI imports.

Extractive summarization with a TextRank-style algorithm: TF-IDF sentence
vectors, cosine similarity graph, power-method centrality, MMR-style
redundancy penalty. Plus structure detection (abstract/methods/results
sections), keyword extraction and contribution heuristics. Fully offline.
"""
from __future__ import annotations
import re
import numpy as np

SECTION_HEADS = {
    "abstract": r"^\s*abstract\b",
    "introduction": r"^\s*(?:1\.?\s*)?introduction\b",
    "methods": r"^\s*(?:\d\.?\s*)?(?:methods?|methodology|materials and methods|approach)\b",
    "results": r"^\s*(?:\d\.?\s*)?(?:results?|experiments?|evaluation|findings)\b",
    "discussion": r"^\s*(?:\d\.?\s*)?discussion\b",
    "conclusion": r"^\s*(?:\d\.?\s*)?(?:conclusions?|concluding remarks)\b",
}

STOP = set("""a an the and or but if then else when at by for with about into through during before after above below to from up down in out on off over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now of is are was were be been being have has had having do does did doing would could ought i you he she it we they them his her its our their this that these those as""".split())


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z(])", text)
    return [s.strip() for s in sents if len(s.split()) >= 5]


def _tfidf(sents: list[str]):
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", sublinear_tf=True)
    X = vec.fit_transform([s.lower() for s in sents])
    return vec, X


def textrank_scores(X) -> np.ndarray:
    """Power-method centrality over the cosine similarity graph."""
    from sklearn.metrics.pairwise import cosine_similarity
    S = cosine_similarity(X)
    np.fill_diagonal(S, 0.0)
    n = S.shape[0]
    if n == 0:
        return np.array([])
    row_sum = S.sum(axis=1, keepdims=True)
    row_sum[row_sum == 0] = 1.0
    P = S / row_sum
    d = 0.85
    v = np.ones(n) / n
    for _ in range(60):
        v_new = d * P.T @ v + (1 - d) / n
        if np.abs(v_new - v).sum() < 1e-8:
            v = v_new
            break
        v = v_new
    return v


def summarize(text: str, ratio: float = 0.2, max_sents: int = 8) -> dict:
    """Summarize text. Returns dict with summary sentences in original order."""
    sents = split_sentences(text)
    if len(sents) < 3:
        raise ValueError("Need at least 3 sentences to summarize.")
    k = max(1, min(max_sents, round(len(sents) * ratio)))
    vec, X = _tfidf(sents)
    scores = textrank_scores(X)
    # MMR-style greedy pick: high centrality, low overlap with chosen
    from sklearn.metrics.pairwise import cosine_similarity
    S = cosine_similarity(X)
    chosen: list[int] = []
    cand = list(np.argsort(-scores))
    lam = 0.7
    while len(chosen) < k and cand:
        best, best_val = None, -1e9
        for i in cand:
            red = max((S[i, j] for j in chosen), default=0.0)
            val = lam * scores[i] - (1 - lam) * red
            if val > best_val:
                best, best_val = i, val
        chosen.append(best)
        cand.remove(best)
    chosen.sort()
    return {
        "summary_sentences": [sents[i] for i in chosen],
        "summary": " ".join(sents[i] for i in chosen),
        "picked_indices": chosen,
        "scores": [round(float(s), 4) for s in scores],
        "sentence_count": len(sents),
        "compression": round(k / len(sents), 3),
    }


def detect_sections(text: str) -> dict[str, str]:
    """Map canonical section name -> section body (first 1500 chars)."""
    lines = text.split("\n")
    heads = []
    for idx, line in enumerate(lines):
        for name, pat in SECTION_HEADS.items():
            if re.match(pat, line.strip(), re.I) and len(line.strip()) < 60:
                heads.append((idx, name))
                break
    out = {}
    for i, (idx, name) in enumerate(heads):
        end = heads[i + 1][0] if i + 1 < len(heads) else len(lines)
        if name not in out:
            out[name] = " ".join(l.strip() for l in lines[idx + 1:end] if l.strip())[:1500]
    return out


def keywords(text: str, top: int = 10) -> list[str]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", max_features=2000, sublinear_tf=True)
    X = vec.fit_transform([text.lower()])
    scores = np.asarray(X.sum(axis=0)).ravel()
    terms = np.array(vec.get_feature_names_out())
    order = np.argsort(-scores)[: top * 3]
    seen, out = set(), []
    for i in order:
        t = terms[i]
        head = t.split()[0]
        if head in seen:
            continue
        seen.add(head)
        out.append(t)
        if len(out) >= top:
            break
    return out


def contributions(text: str) -> list[str]:
    """Sentences that look like stated contributions/findings."""
    sents = split_sentences(text)
    pats = re.compile(r"\b(we (?:propose|present|introduce|show|demonstrate|find|found|develop)|our (?:results?|method|approach|model|findings)|this (?:paper|work|study) (?:presents?|proposes?|shows?|demonstrates?)|outperform|state-of-the-art|improv\w+ by|achiev\w+)\b", re.I)
    return [s for s in sents if pats.search(s)][:8]


def analyze_paper(text: str, ratio: float = 0.2) -> dict:
    text = text.strip()
    if len(text) < 200:
        raise ValueError("Paper text is too short (need at least ~200 characters).")
    summ = summarize(text, ratio=ratio)
    return {
        **summ,
        "sections": detect_sections(text),
        "keywords": keywords(text),
        "contributions": contributions(text),
    }
