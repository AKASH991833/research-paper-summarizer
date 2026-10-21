import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from paper_summarizer import analyze_paper, summarize, detect_sections, keywords, split_sentences

PAPER = """
Abstract
We propose a lightweight attention mechanism for edge devices that reduces inference cost by 43% while preserving accuracy. Our method prunes redundant attention heads using a learned importance score. Experiments on three benchmarks show our approach outperforms prior efficient transformers.

1. Introduction
Transformers have become the default architecture for language tasks. Their quadratic attention cost makes deployment on edge hardware difficult. Prior work compresses models via distillation or quantization. In this work we present head-importance pruning, a structured approach that removes entire attention heads. This paper demonstrates that up to half of all heads can be removed with minimal quality loss.

2. Methods
We learn an importance score per attention head using gradient-based sensitivity. The score estimates the expected loss change when a head is removed. Heads are ranked and the lowest scoring heads are pruned. The pruned network is fine-tuned for a short schedule to recover accuracy.

3. Results
Our method reduces FLOPs by 43% on the base model. On GLUE tasks accuracy drops by only 0.4 points on average. We outperform prior efficient transformers at the same compute budget. Latency on a mobile CPU improves by 1.8x. Ablation studies show the importance score is the key component.

4. Discussion
The approach assumes redundancy across heads, which holds for large models. For small models the benefit is reduced. Future work explores joint pruning of heads and layers.

5. Conclusion
We presented head-importance pruning, a simple and effective compression method. Our results show large speedups with negligible accuracy loss.
"""

def test_summary_picks_key_sentences():
    r = analyze_paper(PAPER, ratio=0.25)
    assert r["sentence_count"] >= 15
    assert 3 <= len(r["summary_sentences"]) <= 8
    joined = " ".join(r["summary_sentences"]).lower()
    # key result sentences should survive
    assert "43%" in joined or "head-importance pruning" in joined

def test_sections_detected():
    r = analyze_paper(PAPER)
    secs = r["sections"]
    for name in ("abstract", "introduction", "methods", "results", "conclusion"):
        assert name in secs, secs.keys()
    assert "attention" in secs["abstract"].lower()
    assert "FLOPs" in secs["results"]

def test_keywords_relevant():
    r = analyze_paper(PAPER)
    kw = " ".join(r["keywords"])
    assert "attention" in kw
    assert any("head" in k for k in r["keywords"])

def test_contributions_found():
    r = analyze_paper(PAPER)
    assert len(r["contributions"]) >= 2
    assert any("propose" in c.lower() or "present" in c.lower() for c in r["contributions"])

def test_short_rejected():
    try:
        analyze_paper("Tiny text.")
        assert False
    except ValueError:
        pass

def test_no_duplicate_content():
    r = analyze_paper(PAPER, ratio=0.2)
    s = r["summary_sentences"]
    assert len(set(s)) == len(s)

def test_sentence_splitter():
    s = split_sentences("The first sentence here works well enough. The second one follows it right now! Is a third one really needed here?")
    assert len(s) == 3

if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"All {len(fns)} tests passed.")
