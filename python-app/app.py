import streamlit as st
from paper_summarizer import analyze_paper

st.set_page_config(page_title="Research Paper Summarizer (Python)", page_icon="📄", layout="wide")
st.title("Research Paper Summarizer")
st.caption("TextRank-style extractive summarization, section detection, keywords and contribution extraction - fully offline.")

SAMPLE = """Abstract
We propose a lightweight attention mechanism for edge devices that reduces inference cost by 43% while preserving accuracy. Our method prunes redundant attention heads using a learned importance score. Experiments on three benchmarks show our approach outperforms prior efficient transformers.

1. Introduction
Transformers have become the default architecture for language tasks. Their quadratic attention cost makes deployment on edge hardware difficult. Prior work compresses models via distillation or quantization. In this work we present head-importance pruning, a structured approach that removes entire attention heads. This paper demonstrates that up to half of all heads can be removed with minimal quality loss.

2. Methods
We learn an importance score per attention head using gradient-based sensitivity. The score estimates the expected loss change when a head is removed. Heads are ranked and the lowest scoring heads are pruned. The pruned network is fine-tuned for a short schedule to recover accuracy.

3. Results
Our method reduces FLOPs by 43% on the base model. On GLUE tasks accuracy drops by only 0.4 points on average. We outperform prior efficient transformers at the same compute budget. Latency on a mobile CPU improves by 1.8x. Ablation studies show the importance score is the key component.

4. Conclusion
We presented head-importance pruning, a simple and effective compression method. Our results show large speedups with negligible accuracy loss."""

text = st.text_area("Paste paper text", value=SAMPLE, height=280)
ratio = st.slider("Summary length (fraction of sentences)", 0.1, 0.5, 0.2)
if st.button("Summarize", type="primary"):
    try:
        r = analyze_paper(text, ratio=ratio)
    except ValueError as e:
        st.error(str(e)); st.stop()
    c1, c2, c3 = st.columns(3)
    c1.metric("Sentences", r["sentence_count"])
    c2.metric("In summary", len(r["summary_sentences"]))
    c3.metric("Compression", f"{r['compression']:.0%}")
    st.subheader("Summary")
    st.write(r["summary"])
    st.subheader("Keywords")
    st.write(", ".join(r["keywords"]))
    if r["contributions"]:
        st.subheader("Stated contributions")
        for c in r["contributions"]:
            st.write("- " + c)
    if r["sections"]:
        st.subheader("Detected sections")
        for name, body in r["sections"].items():
            with st.expander(name.replace("_", " ").title()):
                st.write(body)
