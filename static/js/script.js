
// ============================
// ART STUDIO - INTERACTIONS
// ============================

// MOBILE NAVIGATION

const menuToggle = document.getElementById("menuToggle");
const navigation = document.getElementById("navigation");

menuToggle.addEventListener("click", () => {
    navigation.classList.toggle("active");
});

// CLOSE MOBILE MENU AFTER CLICKING A LINK

document.querySelectorAll(".navigation a").forEach(link => {
    link.addEventListener("click", () => {
        navigation.classList.remove("active");
    });
});

// SEARCH PANEL

const searchToggle = document.getElementById("searchToggle");
const searchPanel = document.getElementById("searchPanel");

searchToggle.addEventListener("click", () => {
    searchPanel.classList.toggle("active");

    if (searchPanel.classList.contains("active")) {
        document.getElementById("searchInput").focus();
    }
});

// WISHLIST VISUAL INTERACTION

document.querySelectorAll(".wishlist").forEach(button => {

    button.addEventListener("click", () => {

        button.classList.toggle("selected");

        button.textContent =
            button.classList.contains("selected") ? "♥" : "♡";

    });

});

console.log("ART STUDIO website initialized.");
