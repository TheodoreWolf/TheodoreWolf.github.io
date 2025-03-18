---
layout: page
title: MAP estimate of a linear model
importance: 2
category: derivations
---

This one is simple, elegant and a nice bridge between the frequentist and Bayesian worlds.

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

Which is the well-known Ridge regression objective. $$\lambda = \frac{\sigma^2}{\alpha^2}$$ is the regularisation parameter.

