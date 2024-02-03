---
title: "About"
permalink: /about/
layout: single
author_profile: true
---
<script
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"
  type="text/javascript">
</script>

## Intro
Hello, I am a Machine Learning Engineer with a background in Physics and Chemistry.
I am very interested in applications of ML to science, particularly to the problem of climate
change.
I am currently working as a Machine Learning Engineer at <a href="https://carbonre.com/" target=_blank >Carbon Re</a>.
a startup that uses machine learning to help heavy industry companies reduce their carbon footprint. <br>
<br>
Most of my interests revolve around the intersection of ML and the physical sciences.
Right now I am particularly interested in:
applications of deep learning to PDEs (PINNs, NeuralODEs...),
Reinforcement Learning for dynamical systems and Bayesian Deep Learning

## My favourite derivations
### The MAP estimate of a linear model

$$
\begin{align*}
  \theta_{\text{MAP}} &= \arg\max_{\theta} p(\theta | \mathcal{D})\\
    &= \arg\max_{\theta} \frac{p(\mathcal{D} | \theta) p(\theta)}{p(\mathcal{D})} \\
    &= \arg\max_{\theta} p(\mathcal{D} | \theta) p(\theta) \\
    &= \arg\max_{\theta} \log p(\mathcal{D} | \theta) + \log p(\theta) \\
    &= \arg\max_{\theta} \log \prod_{i=1}^N p(y_i | x_i, \theta) + \log p(\theta) \\
    &= \arg\max_{\theta} \sum_{i=1}^N \log p(y_i | x_i, \theta) + \log p(\theta) \\
    &= \arg\max_{\theta} \sum_{i=1}^N \log \mathcal{N}(y_i | \theta^T x_i, \sigma^2) + \log \mathcal{N}(\theta | 0, \alpha^2) \\
    &= \arg\max_{\theta} \sum_{i=1}^N -\frac{1}{2\sigma^2} (y_i - \theta^T x_i)^2 - \frac{1}{2\alpha^2} \theta^T \theta \\
    &= \arg\min_{\theta} \sum_{i=1}^N (y_i - \theta^T x_i)^2 + \frac{\sigma^2}{\alpha^2} \theta^T \theta \\
    &= \arg\min_{\theta} \sum_{i=1}^N (y_i - \theta^T x_i)^2 + \lambda \theta^T \theta \\
\end{align*}
$$
Which is the well-known Ridge regression problem.
