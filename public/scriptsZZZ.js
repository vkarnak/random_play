class Movie {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.releaseYear = data.releaseYear;
    this.rating = data.rating;
    this.duration = data.duration;
    this.price = data.price;
    this.categoryId = data.categoryId;
    this.categoryName = data.categoryName;
  }

  renderCard() {
    return `
      <div class="col-6 col-md-3 mb-4">
        <div class="card bg-dark text-white h-100" style="max-width:220px; margin:auto;">
          <img src="/images/${this.title}.png"
            onerror="this.src='/images/photo.jpg';"
            alt="${this.title}"
            class="card-img-top"
            style="width: 100%; height: 270px; object-fit: cover; border-radius: 12px;">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${this.title}</h5>
            <p class="card-text">${this.description}</p>
            <button class="btn btn-primary mt-auto" onclick="showMovieDetails(${this.id})">View Details</button>
          </div>
        </div>
      </div>
    `;
  }

  renderAdminCard() {
    return `
      <div class="col-6 col-md-3 mb-4">
        <div class="card bg-dark text-white h-100" style="max-width:220px; margin:auto;">
          <img src="/images/${this.title}.png"
            onerror="this.src='/images/photo.jpg';"
            alt="${this.title}"
            class="card-img-top"
            style="width: 100%; height: 270px; object-fit: cover; border-radius: 12px;">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${this.title}</h5>
            <p class="card-text">${this.description}</p>
            <button class="btn btn-warning btn-sm mb-2 edit-button" data-movie="${encodeURIComponent(JSON.stringify(this))}">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMovie(${this.id})">Delete</button>
          </div>
        </div>
      </div>
    `;
  }
}

class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.isAdmin = data.isAdmin;
    this.status = data.status;
  }

  renderProfile() {
    return `
      <h1>Profile</h1>
      <p><strong>Name:</strong> ${this.name}</p>
      <p><strong>Email:</strong> ${this.email}</p>
      <p><strong>Status:</strong> ${this.isAdmin ? "Admin" : "User"}</p>
      ${this.isAdmin ? '<p class="text-warning">Admin Mode Enabled</p>' : ""}
    `;
  }
}

class Category {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }
}

class Order {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.date = data.date;
    this.items = data.items || [];
    this.paymentId = data.paymentId;
  }
}

class OrderItem {
  constructor(data) {
    this.id = data.id;
    this.orderId = data.orderId;
    this.movieId = data.movieId;
    this.quantity = data.quantity;
  }
}

class Payment {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.orderId = data.orderId;
    this.method = data.method;
    this.amount = data.amount;
    this.date = data.date;
  }
}

let selectedMovieId = null;

function renderAdminMovieGrid(data) {
  const grid = document.getElementById("admin-movie-grid");
  grid.innerHTML = data.map(movieData => {
    const movie = movieData instanceof Movie ? movieData : new Movie(movieData);
    return movie.renderAdminCard();
  }).join("");
}

function changeContent(section) {
  const content = document.getElementById("main-content");

  switch (section) {
case "Profile":
  fetch("/profile")
    .then(res => res.json())
    .then(userData => {
      const user = new User(userData);
      content.innerHTML = user.renderProfile();
    });
  break;

case "MyRentals":
  content.innerHTML = `<h1>My Rentals</h1><div id="rental-list" class="row"></div>`;
  fetch("/profile")
    .then(res => res.json())
    .then(user => fetch(`/rentals/${user.id}`))
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("rental-list");
      if (data.length === 0) {
        list.innerHTML = "<p>No rentals yet.</p>";
        return;
      }
      list.innerHTML = data.map(rentalData => {
        const movie = new Movie(rentalData);
        return `
          <div class="col-6 col-md-3 mb-4">
            <div class="card bg-dark text-white" style="max-width:220px; margin:auto;">
              <img src="/images/${movie.title}.png"
                   onerror="this.src='/images/photo.jpg';"
                   alt="${movie.title}"
                   class="card-img-top"
                   style="width: 100%; height: 270px; object-fit: cover; border-radius: 12px;">
              <div class="card-body">
                <h5 class="card-title">${movie.title}</h5>
                <p class="card-text">${movie.description}</p>
                <p><strong>Year:</strong> ${movie.releaseYear}</p>
                <p><strong>Price:</strong> €${movie.price}</p>
                <p><strong>Rented on:</strong> ${formatRigaDate(rentalData.date)}</p>
                <p><strong>Available until:</strong> ${formatRigaDate(rentalData.expiryDate)}</p>
                <button class="btn btn-danger btn-sm mt-2" onclick="deleteRental('${movie.title}', '${rentalData.date}')">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    })
    .catch(err => {
      console.error("Error loading rentals:", err);
      document.getElementById("rental-list").innerHTML = `<p>Error loading rentals.</p>`;
    });
  break;

case "Catalog":
  content.innerHTML = `
    <div class="filters">
      <select id="filter-category" onchange="applyFilters()">
        <option value="">All Categories</option>
        <option value="Action">Action</option>
        <option value="Drama">Drama</option>
        <option value="Science Fiction">Sci-Fi</option>
        <option value="Romance">Romance</option>
        <option value="Fantasy">Fantasy</option>
      </select>
      <select id="filter-rating" onchange="applyFilters()">
        <option value="">All Ratings</option>
        <option value="G">G</option>
        <option value="PG">PG</option>
        <option value="PG-13">PG-13</option>
        <option value="R">R</option>
      </select>
    </div>
    <div id="movie-grid" class="row"></div>
  `;
  fetch("/movies")
    .then(res => res.json())
    .then(data => {
      window.allMovies = data.map(movieData => new Movie(movieData));
      renderMovieGrid(window.allMovies); 
    })
    .catch(error => {
      console.error("Error loading movies:", error);
    });
  break;

case "ManageMovies":
  content.innerHTML = `
    <h2>Manage Movies</h2>
    <form id="add-movie-form" class="mb-4 bg-dark text-white p-3 rounded">
      <h5>Add New Movie</h5>
      <div class="mb-2"><input class="form-control" type="text" name="title" placeholder="Title" required></div>
      <div class="mb-2"><input class="form-control" type="text" name="description" placeholder="Description" required></div>
      <div class="mb-2"><input class="form-control" type="number" name="releaseYear" placeholder="Release Year" required></div>
      <div class="mb-2">
        <select class="form-control" name="rating" required>
          <option value="">Select Rating</option>
          <option value="G">G</option>
          <option value="PG">PG</option>
          <option value="PG-13">PG-13</option>
          <option value="R">R</option>
        </select>
      </div>
      <div class="mb-2"><input class="form-control" type="number" name="duration" placeholder="Duration" required></div>
      <div class="mb-2"><input class="form-control" type="number" step="0.01" name="price" placeholder="Price (€)" required></div>
      <div class="mb-2"><input class="form-control" type="file" name="image" accept="image/*" required></div>
      <div class="mb-2"><select class="form-control" name="categoryId" id="category-select" required></select></div>
      <button class="btn btn-success" type="submit">Add Movie</button>
    </form>
    <div id="admin-movie-grid" class="row"></div>
  `;

  fetch("/categories")
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById("category-select");
      select.innerHTML = categories.map(cat => {
        const category = new Category(cat);
        return `<option value="${category.id}">${category.name}</option>`;
      }).join("");
    });

  document.getElementById("add-movie-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    fetch("/admin/add-movie", {
      method: "POST",
      body: formData,
    })
      .then(res => res.json())
      .then(result => {
        alert(result.success ? "Movie added!" : "Error adding movie.");
        if (result.success) changeContent("ManageMovies");
      });
  });

  fetch("/movies")
    .then(res => res.json())
    .then(data => {
      window.allMovies = data.map(movieData => new Movie(movieData));
      renderAdminMovieGrid(window.allMovies);
    });
  break;

case "ManageUsers":
  content.innerHTML = `
    <h2>Manage Users</h2>
    <div id="user-list" class="list-group"></div>
  `;
  fetch("/all-users")
    .then(res => res.json())
    .then(users => {
      const list = document.getElementById("user-list");
      if (!users.length) {
        list.innerHTML = `<p>No users found.</p>`;
        return;
      }
      list.innerHTML = users.map(userData => {
        const user = new User(userData);
        return `
          <div class="list-group-item bg-dark text-white d-flex justify-content-between align-items-center">
            <div>
              <strong>${user.name}</strong> — ${user.email} 
              (${user.isAdmin ? "Admin" : "User"}) 
              <span class="badge bg-${user.status === "banned" ? "danger" : "success"}">${user.status}</span>
            </div>
            <div>
              ${user.isAdmin ? "" : `
                <button class="btn btn-warning btn-sm me-2" onclick="banUser(${user.id}, '${user.status}')">
                  ${user.status === "banned" ? "Unban" : "Ban"}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Delete</button>
              `}
            </div>
          </div>
        `;
      }).join("");
    })
    .catch(err => {
      console.error("Failed to load users:", err);
      document.getElementById("user-list").innerHTML = `<p>Error loading users.</p>`;
    });
  break;
  }
}

function renderMovieGrid(data) {
  const grid = document.getElementById("movie-grid");
  grid.innerHTML = data.map(movieObj => {
    const movie = movieObj instanceof Movie ? movieObj : new Movie(movieObj);
    return movie.renderCard();
  }).join("");
}

window.showMovieDetails = function (movieId) {
  const movie = window.allMovies.find(m => m.id === movieId);
  if (!movie) return;

  document.getElementById("movieModalTitle").innerText = movie.title;
  document.getElementById("movieModalImage").src = `/images/${movie.title}.png`;
  document.getElementById("movieModalDescription").innerText = movie.description;
  document.getElementById("movieModalYear").innerText = movie.releaseYear;
  document.getElementById("movieModalRating").innerText = movie.rating;
  document.getElementById("movieModalPrice").innerText = movie.price;

  document.getElementById("movieModalDuration").innerText = movie.duration;

  const movieModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("movieModal"));
  movieModal.show();

  document.getElementById("rentMovieBtn").onclick = () => {
    movieModal.hide();
    setTimeout(() => openPaymentModal(movie.id), 300);
  };
};

function openPaymentModal(movieId) {
  const movie = window.allMovies.find(m => m.id === movieId);
  if (!movie) return;

  selectedMovieId = movie.id;
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("paymentModal"));
  modal.show();

  const confirmBtn = document.getElementById("confirm-payment-btn");
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

  newBtn.addEventListener("click", () => {
    const method = document.getElementById("payment-method").value;
    fetch("/rent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: movie.id, quantity: 1, method }),
    })
      .then(res => res.json())
      .then(data => {
        alert(data.error || "Movie rented successfully!");
        if (!data.error) changeContent("MyRentals");
        modal.hide();
      })
      .catch(err => {
        alert("Failed to rent movie.");
        console.error("Rent failed:", err);
        modal.hide();
      });
  });
}

function applyFilters() {
  const category = document.getElementById("filter-category").value;
  const rating = document.getElementById("filter-rating").value;

  const filteredData = window.allMovies
    .map(data => new Movie(data))
    .filter(movie =>
      (!category || movie.categoryName === category) &&
      (!rating || movie.rating === rating)
    );
  renderMovieGrid(filteredData);
}

function deleteRental(title, date) {
  fetch("/profile")
    .then(res => res.json())
    .then(user => {
      fetch("/delete-rental", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, title, date }),
      })
        .then(res => res.json())
        .then(result => {
          alert(result.success ? "Rental deleted" : "Failed to delete rental");
          if (result.success) changeContent("MyRentals");
        });
    });
}

function formatRigaDate(dateStr) {
  const isoStr = dateStr.replace(" ", "T") + "Z";
  const date = new Date(isoStr);
  return new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

document.body.addEventListener("click", function (e) {
  if (e.target.classList.contains("edit-button")) {
    const movieData = JSON.parse(decodeURIComponent(e.target.getAttribute("data-movie")));
    const movie = new Movie(movieData); 
    openEditModal(movie);
  }
});

function openEditModal(movie) {
  document.getElementById("edit-movie-id").value = movie.id;
  document.getElementById("edit-title").value = movie.title;
  document.getElementById("edit-description").value = movie.description;
  document.getElementById("edit-year").value = movie.releaseYear;
  document.getElementById("edit-rating").value = movie.rating;
  document.getElementById("edit-duration").value = movie.duration;
  document.getElementById("edit-price").value = movie.price;

  fetch("/categories")
    .then(res => res.json())
    .then(categories => {
      const select = document.getElementById("edit-category");
      select.innerHTML = categories.map(c =>
        `<option value="${c.id}" ${c.id === movie.categoryId ? "selected" : ""}>${c.name}</option>`
      ).join("");
    });

  bootstrap.Modal.getOrCreateInstance(document.getElementById("editMovieModal")).show();
}

document.body.addEventListener("submit", async function (e) {
  
    e.preventDefault();
    

    const form = e.target;
    const data = {
      id: form.id.value,
      title: form.title.value,
      description: form.description.value,
      releaseYear: form.releaseYear.value,
      rating: form.rating.value,
      duration: form.duration.value,
      price: form.price.value,
      categoryId: form.categoryId.value
    };

    try {
      const res = await fetch("/admin/edit-movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        alert("Movie updated!");
        bootstrap.Modal.getInstance(document.getElementById("editMovieModal")).hide();
        changeContent("ManageMovies");
      } else {
      }
    } catch (err) {
      console.error("Error submitting edit:", err);
      alert("Error.");
    }
});


function deleteMovie(movieId) {
  if (!confirm("Are you sure you want to delete this movie?")) return;
  fetch(`/admin/delete-movie/${movieId}`, { method: "DELETE" })
    .then(res => res.json())
    .then(result => {
      alert(result.success ? "Movie deleted" : "Delete failed");
      if (result.success) changeContent("ManageMovies");
    });
}

function banUser(userId, currentStatus) {
  const action = currentStatus === "banned" ? "unban" : "ban";
  fetch(`/user/${userId}/${action}`, { method: "POST" })
    .then(res => res.json())
    .then(result => {
      alert(result.success ? `User ${action}ned successfully` : "Action failed");
      if (result.success) changeContent("ManageUsers");
    });
}

function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  fetch(`/user/${userId}`, { method: "DELETE" })
    .then(res => res.json())
    .then(result => {
      alert(result.success ? "User deleted" : "Deletion failed");
      if (result.success) changeContent("ManageUsers");
    });
}
