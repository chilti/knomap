# Fundamentos Matemáticos de los Índices H, G y M

Esta referencia define las métricas de impacto individual y de trayectoria para investigadores.

---

## 1. Índice H (Hirsch, 2005)

Un investigador tiene un índice $h$ si $h$ de sus $N_p$ artículos tienen al menos $h$ citas cada uno, y los otros artículos tienen $\le h$ citas:

$$h = \max \{ i \in \mathbb{N} : c_{(i)} \ge i \}$$

donde $c_{(1)} \ge c_{(2)} \ge \dots \ge c_{(N_p)}$ es el vector de citas ordenado de forma decreciente.

---

## 2. Índice G (Egghe, 2006)

Diseñado para dar mayor ponderación a los artículos de impacto excepcional (*top-cited papers*) que el índice H satura:

$$g = \max \left\{ i \in \mathbb{N} : \sum_{j=1}^i c_{(j)} \ge i^2 \right\}$$

Propiedad: Siempre se cumple que $g \ge h$.

---

## 3. Índice M (M-Quotient, Hirsch)

Normaliza el índice H por la duración de la carrera científica del autor para comparar académicos en distintas etapas profesionales:

$$m = \frac{h}{Y_{\text{actual}} - Y_{\text{primer\_paper}} + 1}$$

* $m \approx 1.0$: Científico consolidado con trayectoria regular.
* $m \approx 2.0$: Científico sobresaliente en fase de liderazgo activo.
* $m \ge 3.0$: Investigador de impacto extraordinario (o joven promesa en disciplina de alta citación).
