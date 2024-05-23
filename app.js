const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const {format, parseISO, isValid} = require('date-fns')

const databasePath = path.join(__dirname, 'todoApplication.db')
const app = express()
app.use(express.json())

let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => console.log('Server starting at localhost:3000/'))
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertTodoObjToResponseObj = dbObj => {
  return {
    id: dbObj.id,
    todo: dbObj.todo,
    category: dbObj.category,
    priority: dbObj.priority,
    status: dbObj.status,
    dueDate: dbObj.due_date,
  }
}

const validateStatus = status => {
  const validStatuses = ['TO DO', 'IN PROGRESS', 'DONE']
  return validStatuses.includes(status)
}

const validatePriority = priority => {
  const validPriorities = ['HIGH', 'MEDIUM', 'LOW']
  return validPriorities.includes(priority)
}

const validateCategory = category => {
  const validCategories = ['WORK', 'HOME', 'LEARNING']
  return validCategories.includes(category)
}

const validateDate = date => {
  const parsedDate = parseISO(date)
  return isValid(parsedDate)
}

const hasStatusProp = requestQuery => requestQuery.status !== undefined
const hasPriorityProp = requestQuery => requestQuery.priority !== undefined
const hasPriorityAndStatusProps = requestQuery =>
  requestQuery.priority !== undefined && requestQuery.status !== undefined
const hasCategoryAndStatusProps = requestQuery =>
  requestQuery.category !== undefined && requestQuery.status !== undefined
const hasCategoryProp = requestQuery => requestQuery.category !== undefined
const hasCategoryAndPriorityProps = requestQuery =>
  requestQuery.category !== undefined && requestQuery.priority !== undefined

app.get('/todos/', async (request, response) => {
  let data = null
  let getTodosQuery = ''
  const {search_q = '', priority, status, category} = request.query

  switch (true) {
    case hasStatusProp(request.query):
      if (!validateStatus(status)) {
        response.status(400).send('Invalid Todo Status')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND status = '${status}';`
      break
    case hasPriorityProp(request.query):
      if (!validatePriority(priority)) {
        response.status(400).send('Invalid Todo Priority')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND priority = '${priority}';`
      break
    case hasPriorityAndStatusProps(request.query):
      if (!validatePriority(priority)) {
        response.status(400).send('Invalid Todo Priority')
        return
      }
      if (!validateStatus(status)) {
        response.status(400).send('Invalid Todo Status')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND status = '${status}' AND priority = '${priority}';`
      break
    case hasCategoryAndStatusProps(request.query):
      if (!validateCategory(category)) {
        response.status(400).send('Invalid Todo Category')
        return
      }
      if (!validateStatus(status)) {
        response.status(400).send('Invalid Todo Status')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND status = '${status}' AND category = '${category}';`
      break
    case hasCategoryProp(request.query):
      if (!validateCategory(category)) {
        response.status(400).send('Invalid Todo Category')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND category = '${category}';`
      break
    case hasCategoryAndPriorityProps(request.query):
      if (!validateCategory(category)) {
        response.status(400).send('Invalid Todo Category')
        return
      }
      if (!validatePriority(priority)) {
        response.status(400).send('Invalid Todo Priority')
        return
      }
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%' AND priority = '${priority}' AND category = '${category}';`
      break
    default:
      getTodosQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%';`
  }

  data = await database.all(getTodosQuery)
  response.send(data.map(convertTodoObjToResponseObj))
})

app.get('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const getTodoQuery = `SELECT * FROM todo WHERE id = ${todoId};`
  const todo = await database.get(getTodoQuery)
  response.send(convertTodoObjToResponseObj(todo))
})

app.get('/agenda/', async (request, response) => {
  const {date} = request.query
  if (!validateDate(date)) {
    response.status(400).send('Invalid Due Date')
    return
  }
  const formattedDate = format(parseISO(date), 'yyyy-MM-dd')
  const getTodosQuery = `SELECT * FROM todo WHERE due_date = '${formattedDate}';`
  const todos = await database.all(getTodosQuery)
  response.send(todos.map(convertTodoObjToResponseObj))
})

app.post('/todos/', async (request, response) => {
  const {id, todo, priority, status, category, dueDate} = request.body

  if (!validateStatus(status)) {
    response.status(400).send('Invalid Todo Status')
    return
  }

  if (!validatePriority(priority)) {
    response.status(400).send('Invalid Todo Priority')
    return
  }

  if (!validateCategory(category)) {
    response.status(400).send('Invalid Todo Category')
    return
  }

  if (!validateDate(dueDate)) {
    response.status(400).send('Invalid Due Date')
    return
  }

  const formattedDate = format(parseISO(dueDate), 'yyyy-MM-dd')
  const postTodoQuery = `
    INSERT INTO todo (id, todo, priority, status, category, due_date)
    VALUES (${id}, '${todo}', '${priority}', '${status}', '${category}', '${formattedDate}');
  `
  await database.run(postTodoQuery)
  response.send('Todo Successfully Added')
})

app.put('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const {todo, priority, status, category, dueDate} = request.body

  const previousTodoQuery = `
    SELECT * FROM todo WHERE id = ${todoId};
  `
  const previousTodo = await database.get(previousTodoQuery)

  if (status !== undefined && !validateStatus(status)) {
    response.status(400).send('Invalid Todo Status')
    return
  }

  if (priority !== undefined && !validatePriority(priority)) {
    response.status(400).send('Invalid Todo Priority')
    return
  }

  if (category !== undefined && !validateCategory(category)) {
    response.status(400).send('Invalid Todo Category')
    return
  }

  if (dueDate !== undefined && !validateDate(dueDate)) {
    response.status(400).send('Invalid Due Date')
    return
  }

  const formattedDate =
    dueDate !== undefined
      ? format(parseISO(dueDate), 'yyyy-MM-dd')
      : previousTodo.due_date

  const updateTodoQuery = `
    UPDATE todo
    SET 
      todo = '${todo !== undefined ? todo : previousTodo.todo}',
      priority = '${priority !== undefined ? priority : previousTodo.priority}',
      status = '${status !== undefined ? status : previousTodo.status}',
      category = '${category !== undefined ? category : previousTodo.category}',
      due_date = '${formattedDate}'
    WHERE id = ${todoId};
  `
  await database.run(updateTodoQuery)

  if (status !== undefined) {
    response.send('Status Updated')
  } else if (priority !== undefined) {
    response.send('Priority Updated')
  } else if (category !== undefined) {
    response.send('Category Updated')
  } else if (dueDate !== undefined) {
    response.send('Due Date Updated')
  } else {
    response.send('Todo Updated')
  }
})

app.delete('/todos/:todoId/', async (request, response) => {
  const {todoId} = request.params
  const deleteTodoQuery = `
    DELETE FROM todo WHERE id = ${todoId};
  `
  await database.run(deleteTodoQuery)
  response.send('Todo Deleted')
})

module.exports = app
