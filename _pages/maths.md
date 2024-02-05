---
layout: single
title:  "Maths"
permalink: /maths/
author_profile: true
---
<script
  src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"
  type="text/javascript">
</script>

As a true nerd, I have some favourite derivations and proofs. Here are a few of them in no particlar order. I aim to update these throughout my life as I come across new ones.

## Table of Contents
1. [The MAP estimate of a linear model](#the-map-estimate-of-a-linear-model)
2. [The integral of the Gaussian Distribution](#the-integral-of-the-gaussian-distribution)
3. [The score function trick for REINFORCE](#the-score-function-trick-for-reinforce)




### The MAP estimate of a linear model 

This one is simple and elegant and a nice bridge between the frequentist and Bayesian worlds.

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
Which is the well-known Ridge regression objective.


### The integral of the Gaussian distribution
This one is just beautiful, links $$\pi$$ and $$e$$ together even though they really don't seem related.

$$
\begin{align*}
  \int{e^{-x^2} dx} &= \sqrt{\int{e^{-x^2} dx} \int{e^{-x^2} dx}} \\
  &\text{Switching to a dummy variable}\\
    &=  \sqrt{\int{e^{-x^2} dx} \int{e^{-y^2} dy}} \\
    &= \sqrt{\int\int{e^{-(x^2 + y^2)} dx\, dy}} \\
\end{align*}\\
$$

We can now swap to polar coordinates by using well-known identities.

$$
  \begin{align*}
    x &= r \cos(\theta) \\
    y &= r \sin(\theta) \\
    dx\, dy &= r dr\, d\theta\\
  \end{align*}
$$

Subbing everything in:

$$
  \begin{align*}
    \int\int{e^{-(x^2 + y^2)} dx\, dy} &= \int\int{e^{-(r \cos(\theta))^2 - (r \sin(\theta))^2} r dr\, d\theta } \\
    &= \int\int{e^{-r^2 (\cos(\theta)^2+\sin(\theta)^2 )} r dr\, d\theta} \\
    &= \int\int{e^{-r^2} r dr\, d\theta} \\
    &= \int_0^{2\pi} d\theta \int_0^{\infty} e^{-r^2} r dr \\
    &= 2\pi \int_0^{\infty} e^{-r^2} r dr \\
    &= 2\pi \int_0^{\infty} e^{-u} \frac{1}{2} du \\
    &= \pi\\
    \text{And so:}\\
   \int{e^{-x^2} dx} &= \sqrt{\pi}
\end{align*}
$$

### The score function trick for REINFORCE

The score function trick is just so elegant, the basis of many algorithms in ML. Here, I show it off for the REINFORCE policy gradient algorithm.

Consider a distribution of states $$d(s)$$ and a 
parameterised policy $$\pi_{\theta}(a | s)$$. The objective is to maximise the expected reward under the policy.

$$
\begin{align*}
  J(\theta) = \mathbb{E}_{\pi_\theta, d}[R(a, s)]\\
\end{align*}
$$

$$
\begin{align*}
  \nabla_{\theta} J(\theta) &= \nabla_{\theta} \int  d(s) ds  \int \pi_\theta(a | s) R(a, s) da \\
  &= \int d(s) ds \int \nabla_{\theta} \pi_\theta(a|s) R(a,s) da \\
  &= \int d(s) ds \int \pi_\theta(a|s) \frac{\nabla_{\theta} \pi_\theta(a|s)}{\pi_\theta(a|s)} R(a,s) da \\
\end{align*}
$$

We apply the score function trick: 
$$\nabla_{\theta} \log \pi_\theta(a|s) = \frac{\nabla_{\theta} \pi_\theta(a|s)}{\pi_\theta(a|s)}$$


$$
\begin{align*}
  \nabla_{\theta} J(\theta) &= \int d(s) ds \int \pi_\theta(a|s) \nabla_{\theta} \log \pi_\theta(a|s) R(a,s) da \\
  &= \mathbb{E}_{\pi_\theta, d}[\nabla_{\theta} \log \pi_\theta(a|s) R(a,s)] \\
\end{align*}
$$

We can estimate the gradient of the expected reward by sampling and therefore optimise our policy using gradient ascent.
