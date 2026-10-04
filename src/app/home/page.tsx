// /home is kept as an alias — `/` is the home page for everyone now.
import { redirect } from 'next/navigation';

export default function HomeAlias() {
  redirect('/');
}
