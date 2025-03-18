---
layout: page
title: Linear dynamical systems
importance: 1
category: derivations
---

It is often assumed that the exponential function is the solution to the linear dynamical system.

$$
\begin{align*}
\dot{x} &= Ax \\
x(0) &= x_0
\end{align*}
$$

The solution is given by:

$$
x(t) = e^{At}x_0
$$

Where $$e^{At}$$ is the matrix exponential, not specifically 2.718... to the power of a matrix (which is not defined), 
but $$e$$ as the exponential function. This is defined as the infinite series:

$$
e^{A} = \sum_{n=0}^{\infty} \frac{A^n}{n!}
$$

Let's start by taking small steps $$\Delta t$$ and approximating the solution to the differential equation as:

$$
\begin{align*}
x_{\Delta t} &= x_0 + A\Delta t x_0 \\
x_{2\Delta t} &= x_{\Delta t} + A\Delta t x_{\Delta t} \\
&= x_0 + A\Delta t x_0 + A\Delta t (x_0 + A\Delta t x_0) \\
&= x_0 + A\Delta t x_0 + A\Delta t x_0 + A^2\Delta t^2 x_0 \\
&= x_0 + 2A\Delta t x_0 + A^2\Delta t^2 x_0 \\
&= x_0 (I + 2A\Delta t + A^2\Delta t^2) \\
&= x_0 (I + A\Delta t)^2
\end{align*}
$$

We can see that expanding to the $$n$$th step is:

$$
x_{n\Delta t} = x_0 (I + A\Delta t)^n
$$


We set $$\Delta t = \frac{t}{n}$$ and take the limit as $$n \to \infty$$ (making the steps infinitely small):

$$
\lim_{n \to \infty} \Big[I+\frac{At}{n}\Big]^n 
$$

We can recognise the definition of the exponential function, which is a reformulation of the infinite series:

$$
e^{x} = \lim_{n \to \infty} \Big[1+\frac{x}{n}\Big]^n
$$

Thus, we have shown that:

$$
x(t) = e^{At}x_0
$$












