import Link from "next/link";

export const metadata = {
  title: "Normas del Fantasy — Rollart Fantasy",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-white/10 pt-6">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ice-100/80">{children}</div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{children}</div>
  );
}

export default function NormasPage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-accent">Fantasy</p>
        <h1 className="font-display text-3xl font-semibold text-white">Normas del Fantasy</h1>
        <p className="mt-3 max-w-2xl text-sm text-ice-100/70">
          Estas son las reglas reales que aplica la web al validar tu alineación — no es un
          resumen aparte, es exactamente lo que comprueba el formulario y el servidor al guardar
          tus picks.
        </p>
      </div>

      <Section title="1. Cómo se juega">
        <p>
          Por cada prueba (evento) del calendario, eliges un patinador distinto para cada{" "}
          <strong className="text-white">slot</strong>: un slot es un elemento concreto del
          programa (un salto, una combinación de giros, una secuencia de pasos…) o un bloque de
          componentes del programa (skating skills, transiciones, performance, coreografía).
        </p>
        <p>
          No eliges "quién gana la prueba" de golpe — eliges, elemento a elemento, a quién crees
          que le va a salir mejor esa parte concreta del programa. Al final se suman las notas
          oficiales de cada elemento que elegiste y esa es tu puntuación.
        </p>
        <p className="text-xs text-ice-100/50">
          Por qué funciona así: en patinaje real, la ejecución de cada elemento varía mucho de una
          patinador a otro e incluso de una competición a otra (una combinación de salto puede
          fallar y convertirse en un salto individual, por ejemplo). Elegir por elemento, en vez
          de por posición fija del programa, refleja mejor lo que de verdad pasó sobre la pista.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Programa Corto — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Combo Jump</li>
              <li>Solo Jump</li>
              <li>Axel</li>
              <li>Spins (piruetas)</li>
              <li>Step Sequence</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Programa Largo — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Combo Jump 1 y 2</li>
              <li>Solo Jump 1 y 2</li>
              <li>Spins (piruetas)</li>
              <li>Choreo Sequence</li>
            </ul>
          </Card>
        </div>
        <p>
          En ambos programas hay además 2 slots de{" "}
          <strong className="text-white">Componentes del Programa</strong>: "Skating Skills +
          Transitions" y "Performance + Choreography".
        </p>
        <p className="text-xs text-ice-100/50">
          Inline sigue exactamente esta misma estructura (mismos elementos técnicos y
          componentes) — es la misma disciplina sobre patines en línea.
        </p>
      </Section>

      <Section title="2. Solo Danza">
        <p>
          Solo Danza tiene sus propios elementos, distintos a los de Libre/Inline, pero se juega
          con la misma mecánica: un patinador por slot técnico, más los 2 slots de Componentes del
          Programa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Style Dance — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Pattern Sequence</li>
              <li>Cluster</li>
              <li>Traveling</li>
              <li>Choreo Stop</li>
              <li>Art Sequence</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Freedance — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Foot Sequence</li>
              <li>Cluster</li>
              <li>Traveling</li>
              <li>Choreo Stop</li>
              <li>Dance Step</li>
            </ul>
          </Card>
        </div>
        <p>
          Igual que en Libre, en ambos programas hay además 2 slots de{" "}
          <strong className="text-white">Componentes del Programa</strong>: "Skating Skills +
          Transitions" y "Performance + Choreography".
        </p>
      </Section>

      <Section title="3. Parejas">
        <p>
          Parejas tiene elementos propios (spirales de la muerte, lanzamientos, elevaciones…) que
          no existen en las demás disciplinas, pero se juega con la misma mecánica: un patinador
          — en este caso, una pareja — por slot técnico, más los 2 slots de Componentes del
          Programa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Short Program — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Jumps</li>
              <li>Step Sequence</li>
              <li>Lifts</li>
              <li>Death Spiral</li>
              <li>Combo Spin</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Free Program — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Death Spiral</li>
              <li>Twist</li>
              <li>Jumps</li>
              <li>Throw Jumps</li>
              <li>Choreo Step</li>
              <li>Lifts</li>
            </ul>
          </Card>
        </div>
        <p>
          Igual que en el resto de disciplinas, en ambos programas hay además 2 slots de{" "}
          <strong className="text-white">Componentes del Programa</strong>: "Skating Skills +
          Transitions" y "Performance + Choreography".
        </p>
      </Section>

      <Section title="4. Pareja Danza">
        <p>
          Pareja Danza combina elementos de Danza (Cluster, Choreo Stop, Traveling…) con
          elementos propios de pareja (Lift, Hold Sequence, No Hold Sequence). Misma mecánica que
          el resto: un slot por elemento técnico, más los 2 slots de Componentes del Programa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Style Dance — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Cluster</li>
              <li>Choreo Stop</li>
              <li>Pattern Sequence</li>
              <li>Lift</li>
              <li>Hold Sequence</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Free Dance — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Lifts</li>
              <li>Cluster</li>
              <li>No Hold Sequence</li>
              <li>Choreo Stop</li>
              <li>Traveling</li>
            </ul>
          </Card>
        </div>
        <p>
          Igual que en el resto de disciplinas, en ambos programas hay además 2 slots de{" "}
          <strong className="text-white">Componentes del Programa</strong>: "Skating Skills +
          Transitions" y "Performance + Choreography".
        </p>
      </Section>

      <Section title="5. Show">
        <p>
          Show funciona distinto al resto: se compite en un único programa (no hay Corto/Largo),
          y dentro de la disciplina hay 3 formatos con estructura de puntos diferente —{" "}
          <strong className="text-white">Cuartetos</strong>,{" "}
          <strong className="text-white">Grupos Pequeños</strong> y{" "}
          <strong className="text-white">Grupos Grandes</strong>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Cuartetos — slots técnicos
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Creative</li>
              <li>Canon</li>
              <li>Traveling</li>
              <li>Cluster</li>
            </ul>
            <p className="mt-2 text-xs text-ice-100/60">
              + los 2 slots de Componentes de siempre: "Skating Skills + Transitions" y
              "Performance + Choreography".
            </p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Grupos Pequeños y Grupos Grandes
            </p>
            <p className="text-ice-100/75">
              No hay elementos técnicos como tal: todo el programa se puntúa por Componentes, y
              aquí cada categoría es su propio slot (no se agrupan de 2 en 2 como en el resto):
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Skating Skills</li>
              <li>Group Technique</li>
              <li>Performance</li>
              <li>Idea and Choreography</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="6. Precisión">
        <p>
          Precisión también se compite en un único programa (sin Corto/Largo). Todo equipo
          incluye una lista fija de 8 elementos técnicos — el nivel que elija cada equipo para
          cada uno no cambia qué slots hay, solo la nota.
        </p>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">
            Slots técnicos (8)
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 list-inside list-disc text-ice-100/75">
            <li>Rotating Wheel</li>
            <li>Linear Line</li>
            <li>Pivoting Block</li>
            <li>Move Element</li>
            <li>Intersection</li>
            <li>Traveling</li>
            <li>Creative</li>
            <li>No Hold Element</li>
          </ul>
        </Card>
        <p>
          Igual que en el resto de disciplinas (menos Show), en Componentes hay 2 slots
          agrupados: "Skating Skills + Transitions" y "Performance + Choreography".
        </p>
      </Section>

      <Section title="7. Restricciones al elegir: grupos de calentamiento">
        <p>
          Los patinadores inscritos se agrupan en <strong className="text-white">grupos de
          calentamiento</strong> (warm-up groups), que reflejan su nivel: el grupo con el número
          más alto patina al final y suele reunir a las favoritas. Sin estos límites, todo el
          mundo elegiría siempre a los mismos 3-4 patinadores top, así que hay un máximo por
          grupo:
        </p>
        <div className="space-y-2">
          <Card>
            <p className="font-semibold text-white">Elementos técnicos</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>No puedes repetir el mismo patinador en dos slots técnicos distintos.</li>
              <li>Máximo 2 patinadores técnicos del grupo de calentamiento más alto.</li>
              <li>Máximo 2 patinadores técnicos del segundo grupo más alto.</li>
            </ul>
          </Card>
          <Card>
            <p className="font-semibold text-white">Componentes del programa</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-ice-100/75">
              <li>Máximo 1 patinador por cada grupo de calentamiento.</li>
              <li>
                Aquí sí puedes repetir a alguien que ya hayas usado en un slot técnico — la
                restricción de "no repetir" solo aplica entre slots técnicos.
              </li>
            </ul>
          </Card>
        </div>
        <p className="text-xs text-ice-100/50">
          Estas reglas de grupos se aplican igual en todas las disciplinas disponibles (Libre,
          Inline, Solo Danza, Parejas, Pareja Danza, Show y Precisión). Si en el futuro se añaden
          slots para Figuras, sus límites concretos se anunciarán aparte cuando estén disponibles.
        </p>
      </Section>

      <Section title="8. Cómo se puntúa el Fantasy">
        <p>
          Tu puntuación en una prueba es la suma de las notas oficiales de cada elemento que
          elegiste — la misma nota que aparece en el protocolo oficial de jueces de World Skate
          (TES para elementos técnicos, PCS para componentes). Nosotros cargamos esas notas a mano
          desde los PDFs oficiales en cuanto se publican los resultados.
        </p>
        <p>
          Cada prueba tiene un <strong className="text-white">plazo de cierre</strong> (lo verás
          como fecha límite al elegir tu alineación): pasado ese momento ya no se pueden cambiar
          los picks para esa prueba, para que nadie elija con los resultados ya conocidos.
        </p>
      </Section>

      <Section title="9. Predicción (juego aparte)">
        <p>
          Independiente del Fantasy por elementos, cada prueba tiene también una Predicción donde
          predices el podio y siguientes puestos. Se puntúa así:
        </p>
        <Card>
          <ul className="list-inside list-disc space-y-1 text-ice-100/75">
            <li>
              <strong className="text-white">5 puntos</strong> por cada puesto que aciertes
              exacto.
            </li>
            <li>
              <strong className="text-white">1 punto</strong> si fallas por solo una posición
              (la pusiste 5ª y quedó 4ª o 6ª).
            </li>
            <li>
              <strong className="text-white">+2 puntos extra</strong> si predijiste a alguien en
              el podio (1º-3º) y ese patinador terminó también en el podio, aunque no en el
              puesto exacto que le pusiste.
            </li>
            <li>
              <strong className="text-white">+3 puntos de bonus</strong> si aciertas el podio
              completo exacto (1º, 2º y 3º en su orden correcto).
            </li>
          </ul>
        </Card>
      </Section>

      <div className="border-t border-white/10 pt-6">
        <Link
          href="/fantasy"
          className="inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-rink hover:bg-gold/90"
        >
          Ver pruebas abiertas →
        </Link>
      </div>
    </div>
  );
}
