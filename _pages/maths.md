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
4. [Mass-Energy Equivalence](#mass-energy-equivalence)




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

### Mass-Energy Equivalence
The assumptions of special relativity lead to the most famous equation in physics: $$ E=mc^2$$. It derives naturally from the assumption that the speed of light is the same in all frames of reference.
Starting from the definition of Kinetic energy:

$$ 
\begin{align*}
\frac{dK}{dt} = v\frac{dp}{dt} = vm\frac{d}{dt}(\gamma v)
\end{align*}
$$

Where we have used the relativistic momentum: $$ p =  \gamma mv $$, and $$\gamma = (1-v^2/c^2)^{-1/2}$$ is the <a href="https://en.wikipedia.org/wiki/Lorentz_factor" target=_blank >Lorentz factor</a>:

$$
\begin{align*}
\frac{d(\gamma v)}{dt} &= \frac{d}{dt} \frac{v}{\sqrt{1-v^2/c^2}} \\
&= \Bigg[\Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-1/2} + \frac{v^2}{c^2} \Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-3/2}\Bigg] \frac{dv}{dt} \\
&= \Bigg[\Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-1/2}\Bigg\{1 + \frac{v^2}{c^2} \Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-1} \Bigg\} \Bigg] \frac{dv}{dt}\\
&= \Bigg[\Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-1/2}\Bigg\{\frac{1 -v^2/c^2}{1 -v^2/c^2} +  \frac{v^2/c^2}{1 -v^2/c^2}\Bigg\} \Bigg] \frac{dv}{dt}\\
&= \Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-3/2} \frac{dv}{dt}
\end{align*}
$$
Hence:

$$
\begin{align*}
\frac{dK}{dt} &= m\Bigg(1 - \frac{v^2}{c^2}\Bigg)^{-3/2} v\frac{dv}{dt} \\
&= \frac{d}{dt} \frac{m c^2}{\sqrt{1-v^2/c^2}} = \frac{d}{dt} \Big(\gamma m c^2\Big)
\end{align*}
$$

Where we have used the fact that: 

$$
\begin{align*}
\frac{d}{dt} \frac{c^2}{\sqrt{1-v^2/c^2}} = \Big(1 - \frac{v^2}{c^2}\Big)^{-3/2} v\frac{dv}{dt}
\end{align*}
$$

Integrating both sides, knowing that the kinetic energy is zero at rest ($$\gamma=1$$ when $$v=0$$), we get:

$$
\begin{align*}
K &= \gamma m c^2 + C \\
&= \gamma m c^2 - mc^2
\end{align*}
$$

We can  recover the classic Newtonian kinetic energy $$ K = \frac{1}{2} m v^2$$ by taking $$v<<c$$:

$$
\begin{align*}
K &= \gamma m c^2 - mc^2 \\
&= mc^2\Bigg(\frac{1}{\sqrt{1-v^2/c^2}} - 1\Bigg) \\
&= mc^2\Bigg(1 + \frac{1}{2} \frac{v^2}{c^2} + ... - 1\Bigg) \\
&\approx \frac{1}{2} m v^2
\end{align*}
$$

We can interpret $$K= \gamma m c^2 - mc^2$$ as $$K = T - E$$ where $$T$$ is the total energy and $$E$$ is the rest energy. Hence, we have:

$$E = m c^2 $$


