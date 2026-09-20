package withings

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// Response is the envelope every Withings endpoint returns. The HTTP status is
// 200 even for errors; Status carries the outcome. See specs/withings-api.md.
type Response struct {
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
	Error  string          `json:"error"`
}

// MeasureGroup is one measurement session: a step onto the scale, or one blood
// pressure reading. All measures in a group share the group's Date.
type MeasureGroup struct {
	GroupID  int64     `json:"grpid"`
	Attrib   int       `json:"attrib"`
	Date     int64     `json:"date"`
	Created  int64     `json:"created"`
	Category int       `json:"category"`
	DeviceID string    `json:"deviceid"`
	Measures []Measure `json:"measures"`
}

// Measure is a single value inside a group. The number it represents is
// Value * 10^Unit.
type Measure struct {
	Value int64 `json:"value"`
	Type  int   `json:"type"`
	Unit  int   `json:"unit"`
}

// measureResponse is the body of a getmeas response.
type measureResponse struct {
	UpdateTime  int64          `json:"updatetime"`
	Timezone    string         `json:"timezone"`
	More        flexBool       `json:"more"`
	Offset      int            `json:"offset"`
	MeasureGrps []MeasureGroup `json:"measuregrps"`
}

// flexBool accepts both `true` and `1` for the same field. The `more` flag has
// been observed in both encodings and the documentation shows only the boolean
// one; decoding into a bool would fail the whole response on the numeric form.
type flexBool bool

func (b *flexBool) UnmarshalJSON(data []byte) error {
	switch string(data) {
	case "true", "1":
		*b = true
	case "false", "0", "null":
		*b = false
	default:
		// Anything else is treated as "no more pages" rather than an error:
		// stopping early costs one delayed row, failing costs the whole sync.
		*b = false
	}
	return nil
}

// flexString accepts a field that arrives either quoted or as a bare number.
// Withings sent `userid` as a string in the token body until 2026-08-05 and as a
// number from that day on. Decoding into a plain string field fails the whole
// token body, so every refresh returned an error and the integration delivered
// no measurement for 46 days (see INCIDENTS.md, 2026-09-20).
type flexString string

func (s *flexString) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		*s = ""
		return nil
	}
	if trimmed[0] == '"' {
		var str string
		if err := json.Unmarshal(trimmed, &str); err != nil {
			return err
		}
		*s = flexString(str)
		return nil
	}
	var num json.Number
	if err := json.Unmarshal(trimmed, &num); err != nil {
		return fmt.Errorf("decoding %s as string or number: %w", trimmed, err)
	}
	*s = flexString(num.String())
	return nil
}

// tokenBody is the body of a requesttoken response.
type tokenBody struct {
	UserID       flexString `json:"userid"`
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	Scope        string     `json:"scope"`
	ExpiresIn    int        `json:"expires_in"`
	TokenType    string     `json:"token_type"`
}
