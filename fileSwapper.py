from subprocess import call
import os

name1= './tasks/test.js'
name2 = './tasks/testSWAP.js'

if os.path.isfile(name1):
	call(['mv', name1, name2])
	print('moving ' + name1 + ' to ' + name2)
elif os.path.isfile(name2): 
	call(['mv', name2, name1])
	print('moving ' + name2 + ' to ' + name1)