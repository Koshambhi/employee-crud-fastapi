from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend folder
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
def home():
    return FileResponse("frontend/index.html")


# Employee model (UPDATED)
class Employee(BaseModel):
    id: int | None = None
    name: str
    age: int
    position: str
    department: str
    email: str
    salary: float
    experience: int


# In-memory database
employees = []
next_id = 1


@app.get("/employees")
def get_all():
    return employees


@app.get("/employees/{emp_id}")
def get_one(emp_id: int):
    for emp in employees:
        if emp["id"] == emp_id:
            return emp
    raise HTTPException(404, "Employee not found")


@app.post("/employees")
def create(emp: Employee):
    global next_id
    emp.id = next_id
    next_id += 1

    employees.append(emp.dict())
    return emp


@app.put("/employees/{emp_id}")
def update(emp_id: int, updated: Employee):
    for i, emp in enumerate(employees):
        if emp["id"] == emp_id:
            updated.id = emp_id
            employees[i] = updated.dict()
            return updated
    raise HTTPException(404, "Employee not found")


@app.delete("/employees/{emp_id}")
def delete(emp_id: int):
    for emp in employees:
        if emp["id"] == emp_id:
            employees.remove(emp)
            return {"message": "Employee deleted"}
    raise HTTPException(404, "Employee not found")
