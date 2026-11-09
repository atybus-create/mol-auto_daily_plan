import type { CSSProperties } from "react";
import { activityLabels, isMonday, SLOT_COUNT, slotsAt, timeToMinutes } from "@/lib/plan-utils";
import type { Employee } from "@/types/plan";

type ScheduleProps = {
  employees: Employee[];
  date: string;
  collapsed: boolean;
  editingEnabled: boolean;
  onBlockClick: (employeeId: string, blockIndex: number, button: HTMLButtonElement) => void;
};

export function Schedule({ employees, date, collapsed, editingEnabled, onBlockClick }: ScheduleProps) {
  const monday = isMonday(date);
  const markers = [
    { time: "10:00", label: "Cutoff Allegro One" },
    { time: "12:00", label: monday ? "Pozostali + InPost / Orlen (pn)" : "Pozostali kurierzy" },
    ...(!monday ? [{ time: "16:00", label: "InPost / Orlen" }] : []),
  ];

  return (
    <div className="schedule-scroll" tabIndex={0} aria-label="Harmonogram pracowników — przewijaj poziomo">
      <div className="schedule-grid">
        <div className="time-header" aria-hidden="true">
          <div className="employee-head">Pracownik</div>
          {Array.from({ length: 13 }, (_, index) => {
            const hour = 5 + index;
            return (
              <div
                className="hour-block"
                key={hour}
                style={{ gridColumn: `${2 + index * 4} / span 4`, gridRow: 1 }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            );
          })}
          {Array.from({ length: 26 }, (_, index) => {
            const hour = 5 + Math.floor(index / 2);
            const minute = index % 2 ? "30" : "00";
            return (
              <div
                className="half-hour-tick"
                key={`${hour}-${minute}`}
                style={{ gridColumn: `${2 + index * 2} / span 2`, gridRow: 2 }}
              >
                {String(hour).padStart(2, "0")}:{minute}
              </div>
            );
          })}
        </div>

        <div className="group-row">
          <div className="group-label">Zespół wydania · {employees.length} osób</div>
        </div>

        {!collapsed && employees.map((employee) => (
          <div className="employee-row" key={employee.id}>
            <div className="employee-name" style={{ gridColumn: 1 }}>{employee.name}</div>
            {Array.from({ length: SLOT_COUNT }, (_, slot) => (
              <div className="employee-cell" style={{ gridColumn: slot + 2 }} aria-hidden="true" key={slot} />
            ))}
            {employee.blocks.map((block, blockIndex) => {
              const style: CSSProperties = {
                gridColumn: `${2 + slotsAt(block.start)} / span ${(timeToMinutes(block.end) - timeToMinutes(block.start)) / 15}`,
              };
              return (
                <button
                  className={`activity-block ${block.kind}`}
                  type="button"
                  style={style}
                  key={`${employee.id}-${block.start}-${blockIndex}`}
                  aria-label={`${employee.name}: ${activityLabels[block.kind]}, od ${block.start} do ${block.end}.${editingEnabled ? " Wybierz, aby zmienić czynność." : " Włącz tryb edycji, aby zmienić czynność."}`}
                  onClick={(event) => onBlockClick(employee.id, blockIndex, event.currentTarget)}
                >
                  {activityLabels[block.kind]}
                </button>
              );
            })}
          </div>
        ))}

        <div className="grid-rail">
          <div className="rail-label">Punkty kontrolne</div>
          {markers.map((marker) => (
            <div
              className="cutoff-marker"
              key={`${marker.time}-${marker.label}`}
              style={{ gridColumn: `${2 + slotsAt(marker.time)} / span 8` }}
            >
              <b>{marker.time}</b> {marker.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
