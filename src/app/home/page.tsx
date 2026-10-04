// /home is kept as an alias — the profile overview lives at /profile.
import { redirect } from 'next/navigation';

export default function HomeAlias() {
  redirect('/profile');
}
