import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { DEMO_USER_ID, useAuth } from '@/auth';
import { supabase } from '@/utils/supabase';

export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TodoStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const STATUS_COLORS: Record<TodoStatus, string> = {
  todo: '#64748b',
  in_progress: '#d97706',
  done: '#16a34a',
};

export type Todo = {
  id: string;
  title: string;
  description: string;
  status: TodoStatus;
  createdAt: number;
  updatedAt: number;
};

export type TodoInput = Pick<Todo, 'title' | 'description' | 'status'>;

const DEMO_STORAGE_KEY = 'todos.demo';
const LEGACY_STORAGE_KEY = 'todos';

type TodoRow = {
  id: string;
  title: string;
  description: string;
  status: TodoStatus;
  created_at: string;
  updated_at: string;
};

type TodoContextValue = {
  todos: Todo[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  getTodo: (id: string) => Todo | undefined;
  createTodo: (input: TodoInput) => Promise<Todo | null>;
  updateTodo: (id: string, patch: Partial<TodoInput>) => Promise<boolean>;
  deleteTodo: (id: string) => Promise<boolean>;
};

type TodoState = {
  userId: string | null;
  todos: Todo[];
  isLoading: boolean;
  error: string | null;
};

const TodoContext = createContext<TodoContextValue | null>(null);

function createDemoTodo(input: TodoInput): Todo {
  const now = Date.now();
  return {
    ...input,
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function TodoProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<TodoState>({
    userId: null,
    todos: [],
    isLoading: false,
    error: null,
  });
  const stateMatchesUser = state.userId === userId;
  const todos = stateMatchesUser ? state.todos : [];
  const isLoading = userId !== null && (!stateMatchesUser || state.isLoading);
  const error = stateMatchesUser ? state.error : null;

  useEffect(() => {
    let active = true;
    if (!userId) return;

    const loadTodos = async () => {
      try {
        if (userId === DEMO_USER_ID) {
          const storedTodos =
            (await AsyncStorage.getItem(DEMO_STORAGE_KEY)) ??
            (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
          if (!active) return;
          setState({
            userId,
            todos: storedTodos ? (JSON.parse(storedTodos) as Todo[]) : [],
            isLoading: false,
            error: null,
          });
          return;
        }

        const { data, error: loadError } = await supabase
          .from('todos')
          .select('id, title, description, status, created_at, updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!active) return;
        if (loadError) throw loadError;
        setState({ userId, todos: (data ?? []).map(fromRow), isLoading: false, error: null });
      } catch (loadError) {
        if (active) {
          setState({
            userId,
            todos: [],
            isLoading: false,
            error: getErrorMessage(loadError),
          });
        }
      }
    };

    void loadTodos();

    return () => {
      active = false;
    };
  }, [userId]);

  const getTodo = (id: string) => todos.find((todo) => todo.id === id);

  const createTodo = async (input: TodoInput) => {
    if (!userId) return null;
    clearErrorForUser(userId);
    if (userId === DEMO_USER_ID) {
      const todo = createDemoTodo(input);
      setState((current) =>
        current.userId === userId ? { ...current, todos: [todo, ...current.todos] } : current,
      );
      return todo;
    }

    try {
      const { data, error: createError } = await supabase
        .from('todos')
        .insert({ ...input, user_id: userId })
        .select('id, title, description, status, created_at, updated_at')
        .single();
      if (createError) throw createError;
      const todo = fromRow(data);
      setState((current) =>
        current.userId === userId ? { ...current, todos: [todo, ...current.todos] } : current,
      );
      return todo;
    } catch (createError) {
      setErrorForUser(userId, getErrorMessage(createError));
      return null;
    }
  };

  const updateTodo = async (id: string, patch: Partial<TodoInput>) => {
    if (!userId) return false;
    clearErrorForUser(userId);
    if (userId === DEMO_USER_ID) {
      setState((current) =>
        current.userId === userId
          ? {
              ...current,
              todos: current.todos.map((todo) =>
                todo.id === id ? { ...todo, ...patch, updatedAt: Date.now() } : todo,
              ),
            }
          : current,
      );
      return true;
    }

    try {
      const { data, error: updateError } = await supabase
        .from('todos')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, title, description, status, created_at, updated_at')
        .single();
      if (updateError) throw updateError;
      const todo = fromRow(data);
      setState((current) =>
        current.userId === userId
          ? { ...current, todos: current.todos.map((item) => (item.id === id ? todo : item)) }
          : current,
      );
      return true;
    } catch (updateError) {
      setErrorForUser(userId, getErrorMessage(updateError));
      return false;
    }
  };

  const deleteTodo = async (id: string) => {
    if (!userId) return false;
    clearErrorForUser(userId);
    if (userId === DEMO_USER_ID) {
      setState((current) =>
        current.userId === userId
          ? { ...current, todos: current.todos.filter((todo) => todo.id !== id) }
          : current,
      );
      return true;
    }

    try {
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .single();
      if (deleteError) throw deleteError;
      setState((current) =>
        current.userId === userId
          ? { ...current, todos: current.todos.filter((todo) => todo.id !== id) }
          : current,
      );
      return true;
    } catch (deleteError) {
      setErrorForUser(userId, getErrorMessage(deleteError));
      return false;
    }
  };

  const clearErrorForUser = (targetUserId: string) => {
    setState((current) =>
      current.userId === targetUserId ? { ...current, error: null } : current,
    );
  };

  const setErrorForUser = (targetUserId: string, message: string) => {
    setState((current) =>
      current.userId === targetUserId ? { ...current, error: message } : current,
    );
  };

  useEffect(() => {
    if (state.userId !== DEMO_USER_ID || state.isLoading) return;
    void AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state.todos)).catch(
      (storageError: unknown) => setErrorForUser(DEMO_USER_ID, getErrorMessage(storageError)),
    );
  }, [state.userId, state.todos, state.isLoading]);

  return (
    <TodoContext
      value={{
        todos,
        isLoading,
        error,
        clearError: () => clearErrorForUser(userId ?? ''),
        getTodo,
        createTodo,
        updateTodo,
        deleteTodo,
      }}
    >
      {children}
    </TodoContext>
  );
}

export function useTodos() {
  const ctx = use(TodoContext);
  if (!ctx) throw new Error('useTodos must be used inside <TodoProvider>');
  return ctx;
}

function fromRow(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong while connecting to Supabase.';
}
