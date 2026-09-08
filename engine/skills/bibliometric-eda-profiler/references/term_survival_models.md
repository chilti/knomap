# Modelos de Crecimiento y Supervivencia de Términos

Mapea la evolución de conceptos y palabras clave en el tiempo para distinguir entre frentes consolidados y términos efímeros.

---

## 1. Vida Media y Esperanza de Vida de un Término

Dado un término $w$ observado en un rango de años $[Y_{\text{min}}, Y_{\text{max}}]$ con frecuencia anual $f_w(t)$:

* **Año de Emergencia:** $Y_{\text{first}}(w) = \min \{ t : f_w(t) > 0 \}$.
* **Año de Última Observación:** $Y_{\text{last}}(w) = \max \{ t : f_w(t) > 0 \}$.
* **Vida Útil Observada:** $L(w) = Y_{\text{last}}(w) - Y_{\text{first}}(w) + 1$.

---

## 2. Clasificación de Términos por Dinámica

1. **Precursores Consolidados:** Emergencia temprana ($> 10$ años de antigüedad) con persistencia continua y crecimiento sostenido ($f_w(t) \ge f_w(t-1)$).
2. **Frentes de Moda / Efímeros:** Pico súbito de alta frecuencia concentrado en un periodo breve ($L(w) \le 3$ años) seguido de desaparición.
3. **Frentes Emergentes Activos:** $Y_{\text{first}} \ge Y_{\text{actual}} - 3$ años con gradiente de aceleración positivo ($\Delta f_w > 0$).
