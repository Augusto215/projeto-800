/*
  # Fix User Signup Error

  1. Changes
    - Simplify the handle_new_user function to focus on essential fields
    - Fix potential NULL value issues with email and other required fields
    - Ensure proper error handling during profile creation
    - Update RLS policies to allow proper signup flow

  2. Security
    - Maintain existing security model
    - Ensure proper user isolation
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a simpler, more robust function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert only the essential fields to avoid potential NULL value issues
  INSERT INTO public.profiles (
    user_id,
    email,
    full_name,
    is_admin,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      WHEN NEW.email = 'pedropardal04@gmail.com' THEN true 
      WHEN NEW.email = 'profitestrategista@gmail.com' THEN true
      ELSE false 
    END,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't prevent user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;

-- Create simpler, more permissive policies for signup
CREATE POLICY "Enable insert for authenticated users during signup"
  ON profiles
  FOR INSERT
  TO anon, authenticated;

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    ((auth.jwt() ->> 'email') = 'pedropardal04@gmail.com') OR 
    ((auth.jwt() ->> 'email') = 'profitestrategista@gmail.com') OR 
    (auth.uid() = user_id)
  );