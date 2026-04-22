# NestJS App README template

This is a NestJS application designed to provide [brief description of your app]. It is built using the powerful NestJS framework to ensure scalability, maintainability, and performance

## Getting Started

Follow these steps to set up and run the project on your local machine. 


---

### Prerequisites

Make sure you have the following installed on your system:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)

---

### Clone the Repository

To clone the repository, run the following command:

```bash
  git clone https://github.com/Sleeky-Programmers/starter-backend.git new-project-name
```

### Navigate to the Project Directory

```bash
  cd new-project-name
```

### Remove the existing `origin` remote

```bash
  git remote remove origin
```

### Add the remote for the new project

```bash
  git remote add origin <new-repo-url>
```

### Verify the new remote

```bash
  git remote -v
```

### Install Dependencies

```bash
  npm install
```

### Configure Environment Variables

Create a .env file in the root directory of the project and define the necessary environment variables. You can use the .env.sample file as a reference:

```bash
  cp .env.sample .env
```

### Run the Application

To start the application in development mode:

```bash
  npm run start:dev
```

### Running Tests (If available)

Run the test suite to ensure everything is working correctly:

```bash
  npm run test
```

### Additional Commands

- **Build the application for production**:

```bash
  npm run build
```

- **Run the application in production mode**:

```bash
  npm run start:prod
```

### Push changes to the new repository

```bash
  git push -u origin <branch>
```

