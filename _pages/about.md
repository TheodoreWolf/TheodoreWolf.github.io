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

## Experience
<details>

<summary> <i>Machine Learning Engineer</i>, Carbon Re, 2022-Present </summary>
<br>
I am tasked with making ML models based on high dimensional industrial time series.
Most of the focus is on cement data which involves complex physical interactions.
<br>
The work also involves maintaining a complex production environment. The pipeline consists of
many steps:
requesting live data from an API or MQTT (depending on the client),
preprocessing the data with AWS lambdas, storing it in AWS timestream.
This data is then fed to the inference service which loads ML models from WandB and sends the
results to the online web-platform for the clients to view.
</details>

## Education

<details>
<summary> <i>MSc Machine Learning</i>, University College London, 2021-2022</summary>
<br>
<b>Distinction, 84%</b><br>

Studied a wide variety of topics including
NLP, RL, Bayesian Deep Learning, Variational inference.
My dissertation was about using RL in Integrated Assessment Models, work that I then published at NeurIPS 2023.
</details>
<br>
<details>
<summary><i>BSc Astrophysics and Physical Chemistry</i>, University College London, 2018-2021</summary>
<br>
<b>First Class Honours, 79%</b> <br>

Starting from the BSc Natural Sciences, I specialised over time into Astrophysics and Physical
Chemistry.
Got to learn MatLab and some really interesting stuff about the large and small scales of our
universe.
Did you know that there is 6 times more dark matter than regular matter, and yet we've never
directly detected it?
</details>

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

### The log gradient trick for REINFORCE

### The integral of the Gaussian distribution

