import { useEffect, useState } from "react";
import { type FxEvent, subscribeFxEvent } from "./fxBus";
import { AbilityPulse } from "./presets/AbilityPulse";
import { LevelUpBurst } from "./presets/LevelUpBurst";
import { PickupTrail } from "./presets/PickupTrail";

type ActiveFx = { id: number; event: FxEvent };

let nextId = 0;

/**
 * Mount inside the R3F `<Scene>` tree. Listens to `fxBus` events and renders
 * the matching preset at its world position. Each preset unmounts itself on
 * completion.
 */
export function FxOverlay() {
  const [active, setActive] = useState<ActiveFx[]>([]);

  useEffect(() => {
    return subscribeFxEvent((event) => {
      const id = ++nextId;
      setActive((prev) => [...prev, { id, event }]);
    });
  }, []);

  const remove = (id: number) => setActive((prev) => prev.filter((a) => a.id !== id));

  return (
    <>
      {active.map((a) => {
        switch (a.event.kind) {
          case "level-up":
            return <LevelUpBurst key={a.id} at={a.event.at} onDone={() => remove(a.id)} />;
          case "pickup":
            return (
              <PickupTrail
                key={a.id}
                at={a.event.at}
                color={a.event.color}
                onDone={() => remove(a.id)}
              />
            );
          case "ability-pulse":
            return (
              <AbilityPulse
                key={a.id}
                at={a.event.at}
                color={a.event.color}
                onDone={() => remove(a.id)}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
