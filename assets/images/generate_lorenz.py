"""@TheodoreWolf 2024, generates a pretty gif of the Lorenz attractor"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# From Wikipedia: https://en.wikipedia.org/wiki/Lorenz_system
def lorenz(xyz, *, s=10, r=28, b=2.667):
    """
    Parameters
    ----------
    xyz : array-like, shape (3,)
       Point of interest in three-dimensional space.
    s, r, b : float
       Parameters defining the Lorenz attractor.

    Returns
    -------
    xyz_dot : array, shape (3,)
       Values of the Lorenz attractor's partial derivatives at *xyz*.
    """
    x, y, z = xyz
    x_dot = s * (y - x)
    y_dot = r * x - y - x * z
    z_dot = x * y - b * z
    return np.array([x_dot, y_dot, z_dot])


def main():
    dt = 0.01
    num_steps = 5000

    xyzs = np.empty((num_steps + 1, 3))  # Need one more for the initial values
    xyzs[0] = (0.0, 1.0, 1.05)  # Set initial values
    # Integrate with Euler method
    for i in range(num_steps):
        xyzs[i + 1] = xyzs[i] + lorenz(xyzs[i]) * dt

    # setup the figure size
    fig = plt.figure(figsize=(10, 3), dpi=300)
    ax = fig.add_subplot(111, projection="3d")
    ax.set_xlim(-20, 20)
    ax.set_ylim(-20, 20)
    ax.set_zlim(5, 55)
    ax.grid(False)
    ax.axis("off")
    ax.set_facecolor("black")
    fig.patch.set_facecolor("black")
    line = ax.plot(xyzs[0, 0], xyzs[0, 1], xyzs[0, 2], lw=0.5, color="red")[0]
    plt.tight_layout()

    # setup save
    writer = animation.PillowWriter(fps=60)
    writer.setup(
        fig,
        "lorenz.gif",
        dpi=400,
    )

    def update(frame):
        line.set_xdata(xyzs[:frame, 0])
        line.set_ydata(xyzs[:frame, 1])
        line.set_3d_properties(xyzs[:frame, 2])
        return line
    
    for j in np.arange(0, num_steps, 10):
        update(j)
        writer.grab_frame()
    writer.finish()


if __name__=="__main__":
    main()