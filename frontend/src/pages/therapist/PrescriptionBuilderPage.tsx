import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { Exercise, Plan, PrescribedExerciseInput } from "../../api/types";
import { useAsync } from "../../lib/useAsync";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SelectField, TextAreaField, TextField } from "../../components/ui/Field";
import { FullPageSpinner } from "../../components/ui/Spinner";

interface DraftItem extends PrescribedExerciseInput {
  key: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusWeeks(weeks: number): string {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function draftFromPlan(plan: Plan): DraftItem[] {
  return plan.prescribed_exercises
    .filter((item) => item.active)
    .map((item) => ({
      key: `existing-${item.id}`,
      exercise_id: item.exercise_id,
      sets: item.sets,
      repetitions: item.repetitions,
      frequency_per_day: item.frequency_per_day,
      instructions: item.instructions,
      target_rom: item.target_rom,
    }));
}

/**
 * The prescription builder. This screen is the only place a rehabilitation
 * plan is authored - patients have no equivalent, and the assistant cannot
 * reach this API at all.
 */
export function PrescriptionBuilderPage() {
  const { patientId } = useParams();
  const id = Number(patientId);
  const navigate = useNavigate();

  const patient = useAsync(() => api.patient(id), [id]);
  const catalogue = useAsync(() => api.exercises(), []);
  const plans = useAsync(() => api.patientPlans(id), [id]);

  const activePlan = useMemo(
    () => plans.data?.find((plan) => plan.status === "active") ?? null,
    [plans.data],
  );

  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(plusWeeks(4));
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedPlanId, setLoadedPlanId] = useState<number | null>(null);

  // Editing an existing plan starts from its current contents.
  useEffect(() => {
    if (activePlan && loadedPlanId !== activePlan.id) {
      setTitle(activePlan.title);
      setCondition(activePlan.condition);
      setStartDate(activePlan.start_date);
      setEndDate(activePlan.end_date ?? "");
      setItems(draftFromPlan(activePlan));
      setLoadedPlanId(activePlan.id);
    }
  }, [activePlan, loadedPlanId]);

  const exercisesById = useMemo(() => {
    const map = new Map<number, Exercise>();
    catalogue.data?.forEach((exercise) => map.set(exercise.id, exercise));
    return map;
  }, [catalogue.data]);

  const available = useMemo(
    () => catalogue.data?.filter((e) => !items.some((item) => item.exercise_id === e.id)) ?? [],
    [catalogue.data, items],
  );

  function addExercise(exerciseId: number) {
    const exercise = exercisesById.get(exerciseId);
    if (!exercise) return;
    setItems((current) => [
      ...current,
      {
        key: `new-${exerciseId}-${Date.now()}`,
        exercise_id: exerciseId,
        sets: 3,
        repetitions: 10,
        frequency_per_day: 1,
        instructions: exercise.patient_cue,
        target_rom: exercise.default_target_rom,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<PrescribedExerciseInput>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!items.length) {
      setError("Add at least one exercise to the plan.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("The end date is before the start date.");
      return;
    }

    const payloadItems: PrescribedExerciseInput[] = items.map(({ key: _key, ...item }) => item);
    setSaving(true);
    try {
      if (activePlan) {
        await api.updatePlan(activePlan.id, {
          title,
          condition,
          start_date: startDate,
          end_date: endDate || null,
          items: payloadItems,
        });
      } else {
        await api.createPlan(id, {
          title,
          condition,
          start_date: startDate,
          end_date: endDate || null,
          items: payloadItems,
        });
      }
      navigate(`/clinic/patients/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan.");
    } finally {
      setSaving(false);
    }
  }

  if (patient.loading || catalogue.loading || plans.loading) {
    return <FullPageSpinner label="Loading the plan" />;
  }
  if (patient.error) return <Alert tone="error">{patient.error}</Alert>;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          {activePlan ? "Edit rehabilitation plan" : "Create rehabilitation plan"}
        </h1>
        <p className="text-sm text-muted">
          Patient: <span className="font-medium text-text">{patient.data?.name}</span>
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {activePlan && (
        <Alert tone="info">
          Changes take effect immediately. {patient.data?.name} will see the updated routine the
          next time they open the app. Past sessions are kept.
        </Alert>
      )}

      <Panel>
        <PanelHeader title="Plan" />
        <PanelBody className="space-y-4">
          <TextField
            label="Plan title"
            required
            placeholder="Week 1 — Post-operative knee"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Condition"
            placeholder="Post-operative knee rehabilitation"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Start date"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <TextField
              label="End date"
              type="date"
              hint="Adherence is only counted between these dates."
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Prescribed exercises"
          description="The patient sees exactly these, in this order."
        />
        <PanelBody className="space-y-4">
          {items.length === 0 && (
            <p className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No exercises added yet.
            </p>
          )}

          {items.map((item, index) => {
            const exercise = exercisesById.get(item.exercise_id);
            return (
              <div key={item.key} className="rounded-card border border-line bg-surface-sunken p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text">
                      {index + 1}. {exercise?.name ?? "Exercise"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {exercise?.cv_supported ? (
                        <Badge tone="brand">Camera tracked</Badge>
                      ) : (
                        <Badge tone="neutral">Self-reported</Badge>
                      )}
                      <span className="text-xs text-muted">{exercise?.description}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((c) => c.filter((i) => i.key !== item.key))}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <TextField
                    label="Sets"
                    type="number"
                    min={1}
                    max={10}
                    value={item.sets}
                    onChange={(e) => updateItem(item.key, { sets: Number(e.target.value) })}
                  />
                  <TextField
                    label="Repetitions"
                    type="number"
                    min={1}
                    max={100}
                    value={item.repetitions}
                    onChange={(e) => updateItem(item.key, { repetitions: Number(e.target.value) })}
                  />
                  <SelectField
                    label="Frequency"
                    value={item.frequency_per_day}
                    onChange={(e) =>
                      updateItem(item.key, { frequency_per_day: Number(e.target.value) })
                    }
                  >
                    <option value={1}>Once a day</option>
                    <option value={2}>Twice a day</option>
                    <option value={3}>Three times a day</option>
                  </SelectField>
                  {exercise?.cv_supported ? (
                    <TextField
                      label="Target range (°)"
                      type="number"
                      min={0}
                      max={180}
                      hint="Used to judge each repetition."
                      value={item.target_rom ?? ""}
                      onChange={(e) =>
                        updateItem(item.key, {
                          target_rom: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <div className="text-xs text-muted sm:pt-8">
                      Not camera tracked — the patient confirms completion themselves.
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <TextAreaField
                    label="Instructions for the patient"
                    hint="Plain language. This is read aloud during the session."
                    value={item.instructions}
                    onChange={(e) => updateItem(item.key, { instructions: e.target.value })}
                  />
                </div>
              </div>
            );
          })}

          {available.length > 0 && (
            <div className="rounded-card border border-line bg-surface-sunken p-4">
              <p className="mb-2 text-sm font-medium text-text">Add an exercise</p>
              <div className="flex flex-wrap gap-2">
                {available.map((exercise) => (
                  <Button
                    key={exercise.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => addExercise(exercise.id)}
                  >
                    + {exercise.name}
                    {exercise.cv_supported && (
                      <span className="text-xs text-accent">· tracked</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={saving}>
          {activePlan ? "Save changes" : "Create plan"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => navigate(`/clinic/patients/${id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
