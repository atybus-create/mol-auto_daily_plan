"use client";

import { useState, type CSSProperties } from "react";
import { activityLabels, isMonday, SLOT_COUNT, slotsAt, timeToMinutes } from "@/lib/plan-utils";
import type { Employee } from "@/types/plan";

type ScheduleProps = {
  employees: Employee[];
  date: string;
  collapsed: boolean;
  editingEnabled: boolean;
  onBlockClick: (employeeId: string, blockIndex: number, button: HTMLButtonElement) => void;
};

const groupDisplayNames: Record<string, string> = {
  "Lider / Specjalista": "Liderzy",
  "Przyjęcia": "Przyjęcie",
  "Wydanie": "Wydanie",
};

export function Schedule({ employees, date, collapsed, editingEnabled, onBlockClick }: ScheduleProps) {
  const monday = isMonday(date);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const preferredGroups = ["Lider / Specjalista", "Przyjęcia", "Wydanie"];
  const groups = [...preferredGroups, ...Array.from(new Set(employees.map(employee => employee.group))).filter(group => !preferredGroups.includes(group))]
    .filter(group => employees.some(employee => employee.group === group));
  const markers = [
    { time: "10:00", label: "Cutoff Allegro One" },
    { time: "12:00", label: monday ? "Pozostali + InPost / Orlen (pn)" : "Pozostali kurierzy" },
    ...(!monday ? [{ time: "16:00", label: "InPost / Orlen" }] : []),
  ];

  function toggleGroup(group: string) {
    setCollapsedGroups(current => ({ ...current, [group]: !current[group] }));
  }

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
                style={{ gridColumn: `${2 + index * 12} / span 12`, gridRow: 1 }}
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
                style={{ gridColumn: `${2 + index * 6} / span 6`, gridRow: 2 }}
              >
                {String(hour).padStart(2, "0")}:{minute}
              </div>
            );
          })}
        </div>

        {groups.map((group) => {
          const groupEmployees = employees.filter((employee) => employee.group === group);
          const groupCollapsed = collapsed || Boolean(collapsedGroups[group]);
          const displayName = groupDisplayNames[group] || group;
          return (
            <div key={group}>
              <div className="group-row">
                <div className="group-label">
                  <button
                    className="group-toggle"
                    type="button"
                    aria-expanded={!groupCollapsed}
                    aria-label={`${groupCollapsed ? "Rozwiń" : "Zwiń"} grupę ${displayName}`}
                    onClick={() => toggleGroup(group)}
                  >
                    <span className="group-toggle-icon" aria-hidden="true">{groupCollapsed ? "▸" : "▾"}</span>
                    <span>{displayName}</span>
                    <span className="group-count">· {groupEmployees.length} osób</span>
                  </button>
                </div>
              </div>

              {!groupCollapsed && groupEmployees.map((employee) => (
                <div className={`employee-row${employee.duty ? " on-duty" : ""}`} key={employee.id}>
                  <div className="employee-name" style={{ gridColumn: 1 }}>
                    <span className="employee-name-main">{employee.name}</span>
                    {employee.duty && <span className="duty-label" title="Dyżur zgodnie z grafikiem Google">DYŻUR</span>}
                  </div>
                  {Array.from({ length: SLOT_COUNT }, (_, slot) => (
                    <div className="employee-cell" style={{ gridColumn: slot + 2 }} aria-hidden="true" key={slot} />
                  ))}
                  {employee.blocks.map((block, blockIndex) => {
                    const style: CSSProperties = {
                      gridColumn: `${2 + slotsAt(block.start)} / span ${(timeToMinutes(block.end) - timeToMinutes(block.start)) / 5}`,
                    };
                    return (
                      <button
                        className={`activity-block ${block.kind}${block.source === "manual" ? " manual" : ""}`}
                        type="button"
                        style={style}
                        key={`${employee.id}-${block.start}-${blockIndex}`}
                        aria-label={`${employee.name}: ${activityLabels[block.kind]}, od ${block.start} do ${block.end}.${editingEnabled ? " Wybierz, aby zmienić czynność." : ""}`}
                        onClick={(event) => onBlockClick(employee.id, blockIndex, event.currentTarget)}
                      >
                        {block.source === "manual" && <span className="manual-lock" aria-hidden="true">◆</span>}
                        {activityLabels[block.kind]}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}

        <div className="grid-rail">
          <div className="rail-label">Punkty kontrolne</div>
          {markers.map((marker) => (
            <div
              className="cutoff-marker"
              key={`${marker.time}-${marker.label}`}
              style={{ gridColumn: `${2 + slotsAt(marker.time)} / span 24` }}
            >
              <b>{marker.time}</b> {marker.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
