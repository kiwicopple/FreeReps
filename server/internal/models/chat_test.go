package models

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"strings"
	"testing"
)

// TestChatValidation prevents arbitrary URLs, disguised files, and invalid local days entering image requests.
func TestChatValidation(t *testing.T) {
	r := ChatRequest{ID: "00000000-0000-4000-8000-000000000001", Message: "Synthetic meal", Timezone: "America/Los_Angeles", LocalDate: "2025-01-14"}
	var imageData bytes.Buffer
	if err := png.Encode(&imageData, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	photo := "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageData.Bytes())
	r.Images = []string{photo}
	if err := r.Validate(); err != nil {
		t.Fatal(err)
	}
	original := r.Hash()
	r.Message += " changed"
	if r.Hash() == original {
		t.Fatal("digest omitted message")
	}
	r.Message = "Synthetic meal"
	cases := map[string]func(*ChatRequest){
		"remote image":    func(r *ChatRequest) { r.Images = []string{"https://example.com/image.jpg"} },
		"disguised image": func(r *ChatRequest) { r.Images = []string{strings.Replace(photo, "image/png", "image/jpeg", 1)} },
		"invalid bytes":   func(r *ChatRequest) { r.Images = []string{"data:image/png;base64,dGV4dA=="} },
		"too many":        func(r *ChatRequest) { r.Images = []string{photo, photo, photo, photo} },
		"invalid date":    func(r *ChatRequest) { r.LocalDate = "2025-02-30" },
		"server timezone": func(r *ChatRequest) { r.Timezone = "Local" },
		"empty":           func(r *ChatRequest) { r.Message = " "; r.Images = nil },
		"invalid id":      func(r *ChatRequest) { r.ID = "no" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			copy := r
			change(&copy)
			if copy.Validate() == nil {
				t.Fatal("accepted invalid request")
			}
		})
	}
	r.Message = ""
	if err := r.Validate(); err != nil {
		t.Fatal("photo-only message rejected", err)
	}
}

// TestChatPublicJSON keeps private persistence metadata out of history responses.
func TestChatPublicJSON(t *testing.T) {
	data, err := json.Marshal(ChatTurn{RequestHash: "private-hash", FoodRequest: &SaveFoodRequest{Reason: "private-proposal"}})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "private-") {
		t.Fatal("private metadata exposed")
	}
}
