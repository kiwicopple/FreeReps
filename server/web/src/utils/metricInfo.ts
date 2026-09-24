import { nutrientInfo } from "./nutrientInfo";

export type MetricDirection = "higher" | "lower" | "context";
export interface MetricInfo {
  summary: string;
  guidance: string;
  direction: MetricDirection;
  source?: string;
}
// General education checked against these primary references on 2026-09-24.
// Direction describes a possible fitness benefit, never a diagnosis or a target.
const heart =
  "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse";
const activity =
  "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html";
const mobility =
  "https://www.apple.com/healthcare/docs/site/Measuring_Walking_Quality_Through_iPhone_Mobility_Metrics.pdf";
const body =
  "https://support.withings.com/hc/en-us/articles/218970957-Body-How-does-the-scale-measure-my-body-composition";
const running =
  "https://support.apple.com/en-mo/guide/watch/apd1f24d4d35/watchos";
const cycling =
  "https://support.apple.com/en-ca/guide/watch/apd4cbc876c7/watchos";
const vitals = "https://medlineplus.gov/ency/article/002341.htm";
const lungs = "https://medlineplus.gov/lab-tests/lung-function-tests/";
const pressure =
  "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings";
const noise = "https://support.apple.com/en-ca/102315";
const stress =
  "https://support.ouraring.com/hc/articles/21205822135315-Daytime-Stress";
const effort =
  "https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/27/watchos/27";
const glucose =
  "https://www.niddk.nih.gov/health-information/diabetes/overview/managing-diabetes";
const dive = "https://support.apple.com/en-gb/102273";
const info = (
  summary: string,
  guidance: string,
  source?: string,
  direction: MetricDirection = "context",
): MetricInfo => ({ summary, guidance, source, direction });
const movementGuide =
  "Regular movement supports health, but more is not always better. Compare complete days and balance activity with recovery; a low total can also mean the device was not worn.";
const compositionGuide =
  "Compare measurements from the same device under similar conditions. Hydration affects scale estimates; a short-term change is not necessarily a change in tissue. The useful direction depends on your goals.";
const runningGuide =
  "Compare similar pace, terrain and effort. These describe technique and workload; there is no single ideal value to maximize or minimize.";
const temperatureGuide =
  "Look for sustained changes under similar conditions. Measurement site, time of day, environment and illness affect temperature; a wearable reading is not enough to diagnose fever.";
const bpGuide =
  "For adults, the AHA defines normal blood pressure as systolic below 120 AND diastolic below 80 mmHg. Both numbers, repeat readings and your treatment plan matter; lower is not always better.";
const scoreGuide =
  "Oura calls scores of 85 or more optimal, 70–84 good, and lower scores a reason to review contributors. These are the provider's guidance, not clinical thresholds.";

export const metricInfo: Record<string, MetricInfo> = {
  heart_rate: info(
    "How many times your heart beats each minute. It changes with movement, rest and stress.",
    "Compare the same situation, such as resting with resting. An all-day average cannot be judged against a resting-heart-rate target.",
    heart,
  ),
  resting_heart_rate: info(
    "Your heart rate during rest, which can reflect cardiovascular conditioning and recovery.",
    "Most adults are around 60–100 bpm at rest; trained people may be lower. A gradual decrease can accompany improved fitness, but medication and illness also affect it. Lower is not always better.",
    heart,
    "lower",
  ),
  walking_heart_rate_average: info(
    "The average effort your heart makes during walking.",
    "A lower value at the same walking pace can suggest improved efficiency. Hills, heat, walking speed and medication can change the result.",
    heart,
    "lower",
  ),
  blood_pressure_heart_rate: info(
    "The pulse recorded when a blood-pressure cuff takes a reading.",
    "Compare relaxed measurements taken the same way. This is separate from the watch's all-day heart rate and does not have a universal better direction.",
    heart,
  ),
  heart_rate_variability: info(
    "HRV is the small variation in time between successive heartbeats, usually reported in milliseconds.",
    "Your own pattern matters more than another person's number. A sustained rise can be consistent with recovery; sleep, stress and illness can shift it. Different devices and HRV methods are not interchangeable.",
    "https://my.clevelandclinic.org/health/articles/21773-heart-rate-variability-hrv",
    "higher",
  ),
  blood_oxygen_saturation: info(
    "An estimate of how much of your blood's oxygen-carrying capacity is in use.",
    "Stable readings in your usual range are more useful than chasing a higher number. Altitude and sensor conditions matter, and wearables can be inaccurate. Persistent unusual readings need confirmation with an appropriate device and clinical advice.",
    "https://www.fda.gov/medical-devices/products-and-medical-procedures/pulse-oximeters",
  ),
  respiratory_rate: info(
    "The number of breaths you take per minute.",
    "Compare readings taken at rest or during similar sleep periods. Activity and illness change breathing rate, so neither a rise nor a fall is automatically good.",
    vitals,
  ),
  body_temperature: info(
    "A body-temperature reading from the reporting device.",
    temperatureGuide,
    vitals,
  ),
  basal_body_temperature: info(
    "Temperature measured at rest, commonly used to follow menstrual-cycle patterns.",
    "Consistency of timing and measurement method matters. Changes can relate to the cycle or illness; this value alone cannot confirm ovulation or pregnancy.",
    vitals,
  ),
  apple_sleeping_wrist_temperature: info(
    "Skin temperature measured at your wrist during sleep. It helps show changes from your own nighttime pattern.",
    "Compare your own nights. Wrist temperature is not core temperature or an on-demand thermometer; cycle changes, alcohol, environment and illness can affect it.",
    "https://support.apple.com/en-au/102674",
  ),
  blood_pressure_systolic: info(
    "The upper blood-pressure number: pressure in the arteries while the heart contracts.",
    bpGuide,
    pressure,
  ),
  blood_pressure_diastolic: info(
    "The lower blood-pressure number: pressure in the arteries between beats.",
    bpGuide,
    pressure,
  ),
  heart_rate_recovery_one_minute: info(
    "How much your heart rate drops in the first minute after exercise.",
    "A larger fall can suggest faster recovery when exercise intensity and the recovery protocol match. Walking during recovery versus stopping can change the comparison.",
    heart,
    "higher",
  ),
  peripheral_perfusion_index: info(
    "The relative strength of a pulse signal at the sensor's measurement site.",
    "Temperature, circulation and sensor placement affect this. Use the reporting device's guidance; a higher reading is not a general fitness goal.",
    "https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/peripheralperfusionindex",
  ),
  electrodermal_activity: info(
    "Changes in the electrical conductance of skin, related to sweat-gland activity.",
    "This is affected by arousal, movement and the environment. It cannot distinguish emotional stress from other causes on its own.",
  ),
  atrial_fibrillation_burden: info(
    "An estimate of the proportion of monitored time showing signs of atrial fibrillation.",
    "Use this with the clinician managing your AFib. Intermittent wearable sampling can miss episodes; the estimate is not a diagnosis and should not guide medication changes.",
    "https://support.apple.com/en-gb/108375",
  ),
  vo2_max: info(
    "An estimate of the maximum oxygen your body can use during hard exercise, relative to body mass.",
    "Higher values generally suggest greater aerobic fitness. Appropriate comparisons depend on age, sex and measurement method. A watch estimates this rather than measuring it in a lab.",
    "https://support.apple.com/en-us/108790",
    "higher",
  ),
  walking_speed: info(
    "How quickly you cover ground when walking.",
    "A rise at a comfortable, comparable effort can suggest improved mobility. Terrain, height and walking conditions also affect it.",
    mobility,
    "higher",
  ),
  walking_step_length: info(
    "The distance between successive steps while walking.",
    "It changes with height and speed. A longer step is not automatically better; compare similar walks.",
    mobility,
  ),
  walking_asymmetry_percentage: info(
    "The proportion of walking with an uneven timing pattern between your two feet.",
    "Lower usually means a more even gait. Look for persistent changes, and consider phone placement, pain and terrain.",
    mobility,
    "lower",
  ),
  walking_double_support_percentage: info(
    "The share of a walking cycle when both feet touch the ground.",
    "It varies with speed and stability. A change can help describe your gait, but do not aim to minimize it independently.",
    mobility,
  ),
  apple_walking_steadiness: info(
    "Apple's estimate of walking stability based on mobility measurements.",
    "Use Apple's steadiness categories and sustained changes. This is a screening signal, not a prediction of an individual fall.",
    "https://support.apple.com/en-mt/guide/iphone/iphbb8259c61/ios",
  ),
  stair_ascent_speed: info(
    "Your vertical speed while going up stairs.",
    "Compare similar stairs and comfortable effort. Greater speed is not a reason to compromise balance or safety.",
  ),
  stair_descent_speed: info(
    "Your vertical speed while going down stairs.",
    "Control and stability matter more than maximizing speed. Use comparable stairs when looking for changes.",
  ),
  six_minute_walk_test_distance: info(
    "The distance covered during a six-minute walking test, a measure of functional exercise capacity.",
    "Longer distances can reflect improved capacity when the test setup and instructions are consistent. Clinical reference values depend on the person and protocol.",
    lungs,
    "higher",
  ),
  running_speed: info(
    "Distance covered per unit of time while running.",
    runningGuide,
    running,
  ),
  running_stride_length: info(
    "The distance covered per running step, as reported by Apple Health.",
    runningGuide,
    running,
  ),
  running_vertical_oscillation: info(
    "How much your torso moves up and down during running.",
    runningGuide,
    running,
  ),
  running_ground_contact_time: info(
    "How long a foot stays on the ground during a running step.",
    runningGuide,
    running,
  ),
  running_power: info(
    "An estimate of the work rate used to run, expressed in watts.",
    runningGuide,
    running,
  ),
  cycling_speed: info(
    "How quickly your bicycle covers ground.",
    "Wind, hills, surface and drafting all matter. Compare similar routes and effort, rather than treating every increase as improved fitness.",
    cycling,
  ),
  cycling_cadence: info(
    "How many pedal revolutions you make each minute.",
    "Useful cadence varies with gearing, terrain and effort. Higher is not automatically better.",
    cycling,
  ),
  cycling_power: info(
    "The rate of work delivered while pedaling, in watts.",
    "Higher power at the same perceived effort can indicate progress. Compare similar intervals, equipment and recovery.",
    cycling,
  ),
  cycling_functional_threshold_power: info(
    "An estimate of the cycling power you can sustain for a prolonged hard effort.",
    "A sustained increase can reflect improved cycling capacity. Test method, duration and equipment should match.",
    cycling,
    "higher",
  ),
  weight_body_mass: info(
    "Your total body mass, including tissue, water and digestive contents.",
    "The useful direction depends on your goals and health. Compare multi-week patterns; day-to-day changes often reflect fluid or food, not just fat.",
    body,
  ),
  body_mass_index: info(
    "BMI relates body mass to height. It is a screening measure, not a direct measure of body fat.",
    "For adults, 18.5 to below 25 is the standard healthy-weight screening category. BMI does not distinguish muscle from fat or assess health by itself; interpretation varies with context.",
    "https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html",
  ),
  body_fat_percentage: info(
    "The estimated share of your body mass that is fat.",
    compositionGuide,
    body,
  ),
  fat_mass: info("The estimated mass of body fat.", compositionGuide, body),
  lean_body_mass: info(
    "Body mass excluding fat; this includes water, organs, muscle and bone.",
    compositionGuide,
    body,
  ),
  muscle_mass: info(
    "The scale's estimate of the mass it classifies as muscle.",
    compositionGuide,
    body,
  ),
  bone_mass: info(
    "An estimate of bone mass from a scale, not a bone-density scan.",
    "Short-term shifts are not evidence of stronger or weaker bones. Do not use this estimate to assess osteoporosis.",
    body,
  ),
  body_water: info(
    "The estimated mass of water in your body, including water within other tissues.",
    compositionGuide,
    body,
  ),
  height: info(
    "Your measured body height, used in calculations such as BMI.",
    "There is no better direction to aim for. An unexpected jump usually deserves a check of units or measurement technique.",
  ),
  waist_circumference: info(
    "The circumference around your waist, used as one indicator of abdominal fat.",
    "Compare measurements at the same position and breathing phase. Suitable thresholds depend on sex, ethnicity and clinical context; combine this with other health information.",
  ),
  step_count: info(
    "The number of steps recorded during a day.",
    movementGuide,
    activity,
    "higher",
  ),
  distance_walking_running: info(
    "The combined distance recorded while walking and running.",
    movementGuide,
    activity,
    "higher",
  ),
  distance_cycling: info(
    "Distance recorded while cycling.",
    movementGuide,
    activity,
  ),
  distance_swimming: info(
    "Distance recorded while swimming.",
    movementGuide,
    activity,
  ),
  distance_wheelchair: info(
    "Distance recorded while moving in a wheelchair.",
    movementGuide,
    activity,
  ),
  flights_climbed: info(
    "The number of flights of stairs climbed, as estimated by the device.",
    movementGuide,
    activity,
  ),
  active_energy: info(
    "Estimated energy used during activity, above resting energy needs.",
    "Use it to compare activity patterns. Wearable calorie estimates are imprecise; a larger burn is not automatically healthier or an exact amount to eat back.",
    activity,
  ),
  basal_energy_burned: info(
    "Estimated energy used for essential functions while at rest.",
    "Body size and the device's calculation affect it. A higher or lower estimate is not a fitness score.",
  ),
  apple_exercise_time: info(
    "Minutes the device classifies as exercise.",
    "Adults generally benefit from at least 150 minutes of moderate activity weekly plus strength work on two days. Device exercise minutes do not always match guideline intensity definitions.",
    activity,
    "higher",
  ),
  apple_move_time: info(
    "Time the device records you moving.",
    movementGuide,
    activity,
  ),
  apple_stand_time: info(
    "Recorded time spent standing and moving upright.",
    "Breaking up long periods of sitting can be useful. Standing time is not a substitute for aerobic and strength activity.",
    activity,
  ),
  push_count: info(
    "Wheelchair pushes detected by the device.",
    movementGuide,
    activity,
  ),
  swimming_stroke_count: info(
    "Swimming strokes recorded during activity.",
    "Compare the same stroke and distance. More strokes can mean more swimming or lower efficiency, so the count alone has no better direction.",
  ),
  distance_downhill_snow_sports: info(
    "Distance recorded during downhill snow-sport activity.",
    "This describes activity volume. Terrain and conditions matter more than trying to maximize the number.",
  ),
  time_in_daylight: info(
    "Time the device estimates you spent in outdoor daylight.",
    "This is an exposure measure, not a target to maximize. It does not measure UV dose; sun protection still matters.",
  ),
  physical_effort: info(
    "An estimate of the intensity of physical activity.",
    "Higher means harder work, not necessarily better training. Interpret it with workout duration, recovery and your plan.",
    effort,
  ),
  estimated_workout_effort_score: info(
    "The device's estimate of how demanding a workout was.",
    "Use it to compare workload, not to score health. The estimate can differ from how hard the session felt.",
    effort,
  ),
  workout_effort_score: info(
    "Your recorded rating of how hard a workout felt.",
    "A lower rating for the same work may suggest adaptation. Hard sessions are not always better; easy sessions also serve a purpose.",
    effort,
  ),
  strength_tonnage: info(
    "Total recorded lifting volume, calculated from weight multiplied by repetitions.",
    "Compare similar exercises and logging habits. More volume is useful only when it fits your plan and recovery; it is not a direct measure of strength.",
  ),
  sleep_analysis: info(
    "The duration of sleep recorded for a day or night.",
    "Most adults need at least seven hours, with needs varying by age. Regular timing, sleep quality and daytime functioning matter too; longer is not always better.",
    "https://www.cdc.gov/sleep/about/",
  ),
  environmental_audio_exposure: info(
    "Sound levels measured around you, in decibels.",
    "Lower exposure is generally better for hearing. Duration matters: Apple cites a weekly limit of 40 hours at 80 dB, with less time at higher levels. An average can hide loud peaks.",
    noise,
    "lower",
  ),
  headphone_audio_exposure: info(
    "The sound level of audio played through headphones.",
    "Lower volume and shorter listening reduce exposure. Hearing risk depends on loudness and duration together; a daily average is not a safety guarantee.",
    noise,
    "lower",
  ),
  forced_vital_capacity: info(
    "The volume of air you can forcefully breathe out after a full breath in.",
    "Interpret with test quality and clinical reference values based on your characteristics. A wearable history alone cannot diagnose a lung condition.",
    lungs,
  ),
  forced_expiratory_volume_1: info(
    "FEV1 is the volume you forcefully exhale in the first second of a breathing test.",
    "It is usually interpreted alongside FVC and predicted reference values. Technique and treatment affect changes.",
    lungs,
  ),
  peak_expiratory_flow_rate: info(
    "The fastest speed of air you can blow out during a forceful breath.",
    "Compare with your established personal best and asthma action plan, using consistent technique. Do not substitute this dashboard's range for your care plan.",
    "https://medlineplus.gov/ency/patientinstructions/000043.htm",
  ),
  inhaler_usage: info(
    "The number of inhaler doses recorded.",
    "Meaning depends on whether the inhaler is preventive or for symptom relief. Follow your prescription and action plan; do not change doses from a trend.",
    "https://medlineplus.gov/asthma.html",
  ),
  blood_glucose: info(
    "The concentration of glucose in your blood.",
    "Meal timing, diabetes status and treatment determine the appropriate range. Both high and low levels matter; use your clinician's targets rather than a higher/lower rule.",
    glucose,
  ),
  insulin_delivery: info(
    "The amount of insulin recorded as delivered.",
    "This is a medication record, not a health target. Never change insulin dosing based on this dashboard's comparisons.",
    glucose,
  ),
  blood_alcohol_content: info(
    "The reported concentration of alcohol in the blood.",
    "It is not a measure of fitness or proof that driving is safe. Measurement timing and method matter.",
  ),
  number_of_times_fallen: info(
    "A count of recorded falling incidents.",
    "Fewer incidents are preferable, but a zero count does not guarantee stability. New or repeated incidents deserve attention to their cause.",
  ),
  uv_exposure: info(
    "Recorded exposure to ultraviolet radiation.",
    "Higher exposure is not a health goal. Use local sun-protection guidance; the meaning of this number depends on the device and unit.",
  ),
  underwater_depth: info(
    "Depth below the water surface measured by the device.",
    "This is an activity measurement, not a health score or a substitute for appropriate diving equipment and training.",
    dive,
  ),
  water_temperature: info(
    "The temperature of the surrounding water.",
    "Comfort and safe exposure depend on time, conditions and equipment. Neither higher nor lower is inherently better.",
    dive,
  ),
  oura_readiness_score: info(
    "Oura's combined estimate of recovery and readiness, based on sleep and other signals.",
    scoreGuide,
    "https://support.ouraring.com/hc/en-us/articles/360025589793-An-Introduction-to-Your-Readiness-Score",
    "higher",
  ),
  oura_sleep_score: info(
    "Oura's summary of several contributors to sleep quality.",
    scoreGuide,
    "https://support.ouraring.com/hc/en-us/articles/360025445574-Sleep-Score",
    "higher",
  ),
  oura_activity_score: info(
    "Oura's assessment of movement, inactivity and activity balance.",
    scoreGuide,
    "https://support.ouraring.com/hc/en-us/articles/360025577993-Activity-Score",
    "higher",
  ),
  oura_temperature_deviation: info(
    "How your nighttime temperature differs from Oura's personal baseline.",
    "Close to your usual level is generally more informative than higher or lower. Illness, cycle changes and environment can shift it; it is not a direct fever reading.",
    "https://support.ouraring.com/hc/en-us/articles/360025589793-An-Introduction-to-Your-Readiness-Score",
  ),
  oura_stress_high: info(
    "Time Oura classifies as high physiological stress.",
    "Stress can reflect physical effort or stimulation, not just emotional strain. Review repeated changes alongside restorative time and how you feel.",
    stress,
  ),
  oura_recovery_high: info(
    "Time Oura classifies as physiologically restorative.",
    "Use it to understand balance between activation and recovery. It is an algorithmic estimate, not proof of complete recovery.",
    stress,
  ),
  oura_resilience: info(
    "Oura's longer-term assessment of balance between stress and recovery.",
    "Use the provider's categories and contributors; this is a composite estimate rather than a clinical measurement.",
    "https://support.ouraring.com/hc/en-us/articles/25358829055251-Resilience",
  ),
  oura_cardiovascular_age: info(
    "Oura's estimate of cardiovascular age from a wearable signal.",
    "Compare long-term changes and the provider's explanation. It is an estimate, not your biological age or a diagnosis.",
    "https://partnersupport.ouraring.com/hc/en-us/articles/47837676430739-Oura-Ring-Overview",
  ),
};

const dietaryAliases: Record<string, string> = {
  energy_consumed: "energy",
  carbohydrates: "carbohydrate",
  fat_total: "fat",
  fat_saturated: "saturated_fat",
  fat_monounsaturated: "monounsaturated_fat",
  fat_polyunsaturated: "polyunsaturated_fat",
  vitamin_a: "vitamin_a_rae",
  vitamin_e: "vitamin_e_alpha_tocopherol",
  thiamin: "thiamin_b1",
  riboflavin: "riboflavin_b2",
  niacin: "niacin_b3",
  pantothenic_acid: "pantothenic_acid_b5",
  folate: "folate_total",
  biotin: "biotin_b7",
};
export function getMetricInfo(name: string): MetricInfo {
  if (metricInfo[name]) return metricInfo[name];
  if (name === "training_tonnage") return metricInfo.strength_tonnage;
  if (name.startsWith("dietary_")) {
    const key = name.slice(8);
    const nutrient = nutrientInfo[dietaryAliases[key] ?? key];
    if (nutrient)
      return info(
        key === "vitamin_a"
          ? "Vitamin A supports vision, immune function and cell growth."
          : key === "vitamin_e"
            ? "Vitamin E acts as an antioxidant, helping protect cell membranes from damage."
            : nutrient.summary,
        "Compare with your nutrition plan and complete logging days. Intake alone cannot establish a deficiency; more is not always better. Apple Health imports may differ from the food log in Nutrition.",
        nutrient.source,
      );
  }
  return info(
    "A measurement supplied by your connected health source. A specific explanation for this metric is not yet available.",
    "Check the original source for its definition and units. You can compare your readings here, but there is no supported healthy range or better direction assigned to this metric.",
  );
}
