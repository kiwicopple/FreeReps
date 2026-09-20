package demo

import (
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/claude/freereps/internal/models"
	"github.com/claude/freereps/internal/storage"
)

// The strength side of the demo data. It exists because the training screens —
// the session list, tonnage, volume per muscle group, estimated 1RM — read
// workout_sets and exercise_templates, and neither is written anywhere else in
// this package. Without them a demo instance shows an app with half its
// screens empty, and the screenshots in docs/ could only be made from real
// data.

// demoExercise is one movement in the plan, carrying what the catalog needs to
// resolve a muscle group and what the generator needs to pick plausible loads.
type demoExercise struct {
	templateID string
	name       string
	muscle     string
	secondary  []string
	equipment  string
	// startKg is the working weight at the start of the 90 days; the generator
	// adds progression on top. reps is the target per working set.
	startKg float64
	stepKg  float64 // added per successful week
	reps    int
}

// The three sessions rotate. Each is a plausible session rather than a
// prescription: the point is that the screens have something with structure to
// show, not that anyone should train this way.
var demoSessions = []struct {
	name      string
	exercises []demoExercise
}{
	{
		name: "Upper",
		exercises: []demoExercise{
			{"DEMO-BENCH", "Bench Press (Barbell)", "chest", []string{"triceps", "shoulders"}, "barbell", 70, 1.25, 8},
			{"DEMO-ROW", "Bent Over Row (Barbell)", "upper_back", []string{"biceps"}, "barbell", 60, 1.25, 8},
			{"DEMO-OHP", "Overhead Press (Barbell)", "shoulders", []string{"triceps"}, "barbell", 40, 1.0, 8},
			{"DEMO-PULLDOWN", "Lat Pulldown (Cable)", "lats", []string{"biceps"}, "machine", 55, 1.5, 10},
			{"DEMO-CURL", "Bicep Curl (Dumbbell)", "biceps", nil, "dumbbell", 14, 0.5, 12},
		},
	},
	{
		name: "Lower",
		exercises: []demoExercise{
			{"DEMO-SQUAT", "Squat (Barbell)", "quadriceps", []string{"glutes", "hamstrings"}, "barbell", 90, 2.0, 6},
			{"DEMO-RDL", "Romanian Deadlift (Barbell)", "hamstrings", []string{"glutes", "lower_back"}, "barbell", 80, 2.0, 8},
			{"DEMO-LEGPRESS", "Leg Press (Machine)", "quadriceps", []string{"glutes"}, "machine", 140, 2.5, 10},
			{"DEMO-CALF", "Standing Calf Raise (Machine)", "calves", nil, "machine", 60, 1.5, 12},
		},
	},
	{
		name: "Full Body",
		exercises: []demoExercise{
			{"DEMO-DEADLIFT", "Deadlift (Barbell)", "lower_back", []string{"hamstrings", "glutes"}, "barbell", 100, 2.5, 5},
			{"DEMO-INCLINE", "Incline Bench Press (Dumbbell)", "chest", []string{"shoulders"}, "dumbbell", 26, 1.0, 10},
			{"DEMO-PULLUP", "Pull Up", "lats", []string{"biceps"}, "none", 0, 0, 8},
			{"DEMO-LUNGE", "Walking Lunge (Dumbbell)", "quadriceps", []string{"glutes"}, "dumbbell", 20, 1.0, 10},
			{"DEMO-FACEPULL", "Face Pull (Cable)", "shoulders", []string{"upper_back"}, "machine", 30, 1.0, 15},
		},
	},
}

// demoExerciseTemplates returns the catalog rows the sets reference. Volume per
// muscle group reads the muscle from here, not from the set.
func demoExerciseTemplates() []storage.ExerciseTemplate {
	var out []storage.ExerciseTemplate
	now := time.Now()
	for _, s := range demoSessions {
		for _, e := range s.exercises {
			secondary := e.secondary
			if secondary == nil {
				secondary = []string{}
			}
			out = append(out, storage.ExerciseTemplate{
				ID:                    e.templateID,
				Title:                 e.name,
				ExerciseType:          "weight_reps",
				PrimaryMuscleGroup:    e.muscle,
				SecondaryMuscleGroups: secondary,
				EquipmentCategory:     e.equipment,
				IsCustom:              false,
				UpdatedAt:             now,
			})
		}
	}
	return out
}

// generateWorkoutSets produces three sessions a week across the range, each
// with a warm-up and three working sets per exercise, on a slow upward trend.
func generateWorkoutSets(rng *rand.Rand, start, end time.Time) []models.WorkoutSetRow {
	var rows []models.WorkoutSetRow

	// Monday, Wednesday, Friday.
	trainingDays := map[time.Weekday]bool{
		time.Monday: true, time.Wednesday: true, time.Friday: true,
	}

	sessionIndex := 0
	for d := start; d.Before(end); d = d.AddDate(0, 0, 1) {
		if !trainingDays[d.Weekday()] {
			continue
		}
		// One session in ten is missed, which is what a real block looks like
		// and what makes the session count on the screens uneven.
		if rng.Float64() < 0.1 {
			sessionIndex++
			continue
		}

		session := demoSessions[sessionIndex%len(demoSessions)]
		sessionIndex++

		week := float64(d.Sub(start).Hours() / (24 * 7))
		sessionStart := d.Add(time.Duration((7.5 + rng.Float64()) * float64(time.Hour)))
		duration := 55*time.Minute + time.Duration(rng.Intn(25))*time.Minute
		sessionEnd := sessionStart.Add(duration)
		sessionName := fmt.Sprintf("%s · Block %s", session.name, d.Format("2006-01"))

		for exNum, ex := range session.exercises {
			// Progression with a plateau: the step shrinks as the weeks pass,
			// so the estimated-1RM curve bends instead of running straight.
			working := ex.startKg + ex.stepKg*week*(1-week/40)
			working = math.Round(working/2.5) * 2.5

			// Warm-up: lighter, more reps, marked so the aggregates exclude it.
			if ex.startKg > 0 {
				rows = append(rows, demoSet(ex, sessionName, sessionStart, sessionEnd, duration,
					exNum+1, 1, true, math.Round(working*0.5/2.5)*2.5, ex.reps+2, rng))
			}

			for set := 1; set <= 3; set++ {
				// Reps drop slightly across the sets, weight holds.
				reps := ex.reps - rng.Intn(2)*(set-1)
				if reps < 1 {
					reps = 1
				}
				rows = append(rows, demoSet(ex, sessionName, sessionStart, sessionEnd, duration,
					exNum+1, set+1, false, working, reps, rng))
			}
		}
	}

	return rows
}

// demoSet builds one row. Bodyweight movements carry weight 0 and the
// bodyweight-plus flag, the case ROADMAP.md records tonnage as not counting.
func demoSet(ex demoExercise, sessionName string, start, end time.Time, duration time.Duration,
	exerciseNumber, setNumber int, warmup bool, weight float64, reps int, rng *rand.Rand) models.WorkoutSetRow {

	endCopy := end
	rir := 3.0
	if !warmup {
		rir = float64(rng.Intn(3))
	}
	setType := "normal"
	if warmup {
		setType = "warmup"
	}

	return models.WorkoutSetRow{
		UserID: userID,
		Source: source,
		// One id per session, not per set: QuerySetSessions selects DISTINCT
		// over external_id, so a per-set id turns one session into as many
		// entries as it has sets in the workout list.
		ExternalID:  fmt.Sprintf("demo-session-%s", start.Format("20060102")),
		RoutineID:   "demo-routine",
		SessionName: sessionName,
		SessionDate: start,
		SessionEnd:  &endCopy,
		SessionDuration: fmt.Sprintf("%d:%02d hr",
			int(duration.Hours()), int(duration.Minutes())%60),
		ExerciseNumber:     exerciseNumber,
		ExerciseName:       ex.name,
		ExerciseTemplateID: ex.templateID,
		Equipment:          ex.equipment,
		TargetReps:         ex.reps,
		IsWarmup:           warmup,
		SetType:            setType,
		SetNumber:          setNumber,
		WeightKg:           weight,
		IsBodyweightPlus:   ex.startKg == 0,
		Reps:               reps,
		RIR:                &rir,
	}
}
