bindir="."
srcdir="."
effect=""

if [ -f ./sox.exe ] ; then
  EXEEXT=".exe"
else
  EXEEXXT=""
fi

# Allow user to override paths.  Useful for testing an installed
# sox.
while [ $# -ne 0 ]; do
    case "$1" in
        --bindir=*)
        bindir=`echo $1 | sed 's/.*=//'`
        ;;

        -i)
        shift
        bindir=$1
        ;;

        --srcdir=*)
        srcdir=`echo $1 | sed 's/.*=//'`
        ;;

        -c)
        shift
        srcdir=$1
        ;;

        *)
        effect="$effect $1"
    esac
    shift
done

t() {
	format=$1
	shift
	opts="$*"

	echo "Format: $format   Options: $opts"
	${bindir}/sox${EXEEXT} ${srcdir}/monkey.wav $opts /tmp/monkey.$format $effect
	${bindir}/sox${EXEEXT} $opts /tmp/monkey.$format /tmp/monkey1.wav  $effect
}
t 8svx
t aiff
t aifc
t au 
t avr -e unsigned-integer
t cdr
t cvs
t dat
t hcom -r 22050
t maud
t prc
t prc -e signed-integer
t sf 
t smp
t sndt 
t txw
t ub -r 8130
t vms
t voc
t vox -r 8130
t wav
t wve
