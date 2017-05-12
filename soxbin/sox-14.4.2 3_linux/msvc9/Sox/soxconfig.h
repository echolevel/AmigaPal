/* libSoX config file for MSVC9: (c) 2009 SoX contributors
 *
 * This library is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or (at
 * your option) any later version.
 *
 * This library is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
 * General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

/* Used only by sox.c: */
#define MORE_INTERACTIVE

#define PACKAGE_EXTRA "msvc"

/* Special behavior defined by win32-ltdl: "./" is replaced with the name of the
   directory containing sox.exe. */
#define PKGLIBDIR "./soxlib"

#define HAVE_AMRNB 1
#define STATIC_AMRNB 1
#define DL_AMRNB 1

#define HAVE_AMRWB 1
#define STATIC_AMRWB 1
#define DL_AMRWB 1

#define HAVE_FLAC 1
#define STATIC_FLAC 1
#define FLAC__NO_DLL

#define HAVE_GSM 1
#define STATIC_GSM 1

#define HAVE_ID3TAG 1

#define DL_LAME 1

#define HAVE_LPC10 1
#define STATIC_LPC10 1

#define HAVE_MAD_H 1
#define DL_MAD 1

#define HAVE_MP3 1
#define STATIC_MP3 1

#define HAVE_OGG_VORBIS 1
#define STATIC_OGG_VORBIS 1

#define HAVE_PNG 1

#define HAVE_SNDFILE 1
#define HAVE_SNDFILE_1_0_12 1
#define HAVE_SNDFILE_1_0_18 1
#define HAVE_SNDFILE_H 1
#define HAVE_SFC_SET_SCALE_FLOAT_INT_READ 1
#define HAVE_SFC_SET_SCALE_INT_FLOAT_WRITE 1
#define STATIC_SNDFILE 1
#define DL_SNDFILE 1

#define HAVE_SPEEXDSP 1

#define HAVE_WAVEAUDIO 1
#define STATIC_WAVEAUDIO 1

#define HAVE_WAVPACK 1
#define HAVE_WAVPACK_H 1
#define STATIC_WAVPACK 1

#define HAVE_CONIO_H 1
#define HAVE__FSEEKI64 1
#define HAVE_FCNTL_H 1
#define HAVE_IO_H 1
#define HAVE_MEMORY_H 1
#define HAVE_POPEN 1
#define HAVE_SPEEXDSP 1
#define HAVE_STDLIB_H 1
#define HAVE_STRDUP 1
#define HAVE_STRING_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TIMEB_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_VSNPRINTF 1
#define HAVE_WIN32_GLOB_H 1
#define HAVE_WIN32_LTDL_H 1

#ifndef __cplusplus
#define inline __inline
#endif
